import fs from 'fs';
import { ObjectId } from 'mongodb';
import Queue from 'bull';
import dbClient from './utils/db';

const imageThumbnail = require('image-thumbnail');

const fileQueue = new Queue('fileQueue');

const createThumbnail = async (localPath, options) => {
  try {
    const thumbImage = await imageThumbnail(localPath, options);
    const thumbFullPath = `${localPath}_${options.width}`;
    await fs.writeFileSync(thumbFullPath, thumbImage);
  } catch (err) {
    console.error(err);
  }
};

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;
  if (!fileId) throw Error('Missing fileId');
  if (!userId) throw Error('Missing userId');

  const file = await dbClient.files.findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!file) throw Error('File not found');

  const { localPath } = file;
  [500, 250, 100].forEach((size) => createThumbnail(localPath, { width: size }));
  done();
});

const userQueue = new Queue('userQueue');

userQueue.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) throw Error('Missing userId');
  const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
  if (!user) throw Error('User not found');
  console.log(`Welcome ${user.email}`);
  done();
});
