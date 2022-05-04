import { expect, use, request } from 'chai';
import chaiHttp from 'chai-http';
import { ObjectId } from 'mongodb';
import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import File from '../utils/file';

use(chaiHttp);

describe('tests for FilesController', () => {
  const user = {
    email: 'devarias@gmail.com',
    password: 'pika4321!',
  };
  let userId = '';
  let authenticationToken = '';

  describe('POST /files', () => {
    before(async () => {
      await dbClient.users.deleteMany({});
      await dbClient.files.deleteMany({});

      const newUser = dbClient.users.insertOne({
        email: user.email, password: sha1(user.password)
      });
      userId = (await newUser).insertedId.toString();
      authenticationToken = uuidv4();
      await redisClient.set(`auth_${authenticationToken}`, userId, 10000);
    });

    after(async () => {
      await dbClient.users.deleteMany({});
      await dbClient.files.deleteMany({});
    });

    it('should return an error Unauthorized with a status code 401', async () => {
      const fileFields = { name: 'myText.txt', type: 'file', data: 'Toe5ac3jHiNQMRTkzNJ1PI==' };
      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', 'aTokenDamaged-2022')
        .send(fileFields);

      expect(response.status).to.equal(401);
      expect(response.body).to.eql({ error: 'Unauthorized' });
    });

    it('should return an error "Missing name" with a status code 400', async () => {
      const fileFields = { type: 'file' };
      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', authenticationToken)
        .send(fileFields);

      expect(response.status).to.equal(400);
      expect(response.body).to.eql({ error: 'Missing name' });
    });

    it('should return an error "Missing name" with a status code 400', async () => {
      const fileFields = { name: 'test.png' };
      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', authenticationToken)
        .send(fileFields);

      expect(response.status).to.equal(400);
      expect(response.body).to.eql({ error: 'Missing type' });
    });

    it('should return an error "Missing data" if type=file|image with no data and status code 400', async () => {
      const fileFields = { name: 'test.png', type: 'image' };
      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', authenticationToken)
        .send(fileFields);

      expect(response.status).to.equal(400);
      expect(response.body).to.eql({ error: 'Missing data' });
    });

    it('should return an error "Parent not found" with a status code 400', async () => {
      const fileFields = {
        name: 'myText.txt', type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==', parentId: '5f1e881cc7ba06511e683b23',
      };
      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', authenticationToken)
        .send(fileFields);

      expect(response.status).to.equal(400);
      expect(response.body).to.eql({ error: 'Parent not found' });
    });

    it('should return an error "Parent not found" with a status code 400', async () => {
      const file = await dbClient.db.collection('files').insertOne({
        name: 'parent.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      });

      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', authenticationToken)
        .send({ name: 'images', type: 'folder', parentId: file.insertedId });

      expect(response.status).to.equal(400);
      expect(response.body).to.eql({ error: 'Parent is not a folder' });
    });

    it('should create a new file in DB and in disk', async () => {
      const fileFields = { name: 'myText.txt', type: 'file', data: 'SGVsbG8gV2Vic3RhY2shCg==' };
      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', authenticationToken)
        .send(fileFields);

      const { body } = response;

      expect(response.status).to.equal(201);
      expect(body).to.have.property('id');
      expect(body).to.have.property('userId').to.be.equal(userId);
      expect(body).to.have.property('name').to.be.equal('myText.txt');
      expect(body).to.have.property('type').to.be.equal('file');
      expect(body).to.have.property('isPublic').to.be.false;
      expect(body).to.have.property('parentId').to.be.equal(0);

      const file = await dbClient.db.collection('files').findOne({
        userId: ObjectId(userId),
        name: fileFields.name,
        type: fileFields.type,
      });
      expect(await File.fileExists(file.localPath)).to.be.true;
      expect(file._id.toString()).to.be.equal(body.id);
    });

    it('should add the new file document in the DB and return the new file with a status code 201', async () => {
      const fileFields = { name: 'files', type: 'folder', isPublic: true };
      const response = await request('http://localhost:5000')
        .post('/files')
        .set('X-Token', authenticationToken)
        .send(fileFields);

      const { body } = response;
      expect(response.status).to.equal(201);
      expect(body).to.have.property('id');
      expect(body).to.have.property('userId').to.be.equal(userId);
      expect(body).to.have.property('name').to.be.equal('files');
      expect(body).to.have.property('type').to.be.equal('folder');
      expect(body).to.have.property('isPublic').to.be.true;
      expect(body).to.have.property('parentId').to.be.equal(0);
    });
  });
});
