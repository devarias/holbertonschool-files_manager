import Queue from 'bull';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import ErrorHandler from '../utils/error';
import File from '../utils/file';
import User from '../utils/user';

class FilesController {
  static async postUpload(request, response) {
    const user = await User.checkAuthorization(request, response);
    if (user === null) return ErrorHandler.unauthorizedUser(response);
    const {
      name, type, parentId, isPublic, data,
    } = request.body;

    const allowedTypes = ['folder', 'file', 'image'];
    if (!name) return ErrorHandler.missingData(response, 'name');
    if (!type || !allowedTypes.includes(type)) return ErrorHandler.missingData(response, 'type');
    if (!data && type !== 'folder') return ErrorHandler.missingData(response, 'data');

    if (parentId) {
      const parentFile = await dbClient.files.findOne({ _id: ObjectId(parentId) });
      if (!parentFile) return ErrorHandler.parentNotFound(response);
      if (parentFile.type !== 'folder') return ErrorHandler.notAFolder(response);
    }
    const documentFields = {
      userId: user._id,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
    };

    if (type === 'folder') {
      const newFolder = await dbClient.files.insertOne({ ...documentFields });
      return response.status(201).json({
        id: newFolder.insertedId,
        ...documentFields,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    await File.createDirectory(folderPath);

    const filename = uuidv4();
    const localPath = `${folderPath}/${filename}`;
    await File.createFile(localPath, data);
    const newDocFile = await dbClient.files.insertOne({
      ...documentFields,
      localPath,
    });

    const fileQueue = new Queue('fileQueue');
    if (type === 'image') {
      fileQueue.add({ userId: user._id, fileId: newDocFile.insertedId });
    }
    return response.status(201).json({
      id: newDocFile.insertedId,
      ...documentFields,
    });
  }

  static async getShow(request, response) {
    const { id } = request.params;
    const user = await User.checkAuthorization(request);

    if (!ObjectId.isValid(id)) return ErrorHandler.notFound(response);
    if (user === null) return ErrorHandler.unauthorizedUser(response);
    const file = await dbClient.files.findOne({
      _id: ObjectId(id),
      userId: ObjectId(user._id),
    });
    if (!file) return ErrorHandler.notFound(response);
    return response.status(200).json(File.normalizeFile(file));
  }

  static async getIndex(request, response) {
    const user = await User.checkAuthorization(request, response);
    if (user === null) return ErrorHandler.unauthorizedUser(response);
    const parentId = request.query.parentId || 0;
    const page = request.query.page || 0;
    const newFiles = await File.aggregateAndPaginateDocs(parentId, page, user);
    return response.status(200).json(newFiles);
  }

  static async putPublish(request, response) {
    FilesController.setIsPublic(request, response, true);
  }

  static async putUnpublish(request, response) {
    FilesController.setIsPublic(request, response, false);
  }

  static async setIsPublic(request, response, publicSetting) {
    const { id } = request.params;
    const user = await User.checkAuthorization(request);
    if (!ObjectId.isValid(id)) return ErrorHandler.notFound(response);
    if (user === null) return ErrorHandler.unauthorizedUser(response);
    const updatedFile = await File.findAndUpdateFile(id, user._id, publicSetting);
    if (!updatedFile) return ErrorHandler.notFound(response);
    return response.status(200).json(File.normalizeFile(updatedFile));
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const { size } = request.query;
    const token = request.header('X-Token');
    if (!ObjectId.isValid(id)) return ErrorHandler.notFound(response);
    const file = await dbClient.files.findOne({
      _id: ObjectId(id),
    });
    if (!file) return ErrorHandler.notFound(response);

    const { isPublic, type } = file;
    const user = await User.checkAuthorization(request);
    if (token) {
      if (user === null) return ErrorHandler.notFound(response);
      if ((user._id.toString() !== file.userId.toString()) && !isPublic) {
        return ErrorHandler.notFound(response);
      }
    }
    if (!token && !isPublic) return ErrorHandler.notFound(response);
    if (type === 'folder') return ErrorHandler.noContent(response);

    let { localPath } = file;
    try {
      if (size) localPath = `${localPath}_${size}`;
      const data = await File.readFile(localPath);
      response.setHeader('Content-Type', mime.contentType(file.name));
      return response.status(200).send(data);
    } catch (err) {
      return ErrorHandler.notFound(response);
    }
  }
}

export default FilesController;
