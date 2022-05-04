import { expect, use, request } from 'chai';
import chaiHttp from 'chai-http';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';

use(chaiHttp);

describe('tests for new user endpoint', () => {
  const user = {
    email: 'some@email.com',
    password: 's4p3rpassw0rd',
  };

  describe('POST /users', () => {
    before(async () => {
      await dbClient.users.deleteMany({});
    });

    after(async () => {
      await dbClient.users.deleteMany({});
    });

    it('should return a 400 error when password is missing', async () => {
      const response = await request('http://localhost:5000').post('/users').send({ email: user.email });
      expect(response).to.have.status(400);
      expect(response.body).to.have.property('error').to.be.equal('Missing password');
    });

    it('should return a 400 error when email is missing', async () => {
      const response = await request('http://localhost:5000').post('/users').send({ password: user.password });
      expect(response).to.have.status(400);
      expect(response.body).to.have.property('error').to.be.equal('Missing email');
    });

    it('should create a user succesfully and return 201', async () => {
      const response = await request('http://localhost:5000').post('/users').send(user);
      expect(response).to.have.status(201);
      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('email').to.be.equal('some@email.com');

      const newUser = await dbClient.users.findOne({ _id: ObjectId(response.body.id) });
      expect(newUser).to.have.property('email').to.be.equal(user.email);
    });

    it('should return 400 error when user already exists in DB', async () => {
      const response = await request('http://localhost:5000').post('/users').send(user);
      expect(response).to.have.status(400);
      expect(response.body).to.have.property('error').to.be.equal('Already exist');
    });
  });
});
