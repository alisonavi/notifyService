(async () => {
  const { expect } = await import('chai');
  const sinon = await import('sinon');
  const grpc = await import('@grpc/grpc-js');
  const protoLoader = await import('@grpc/proto-loader');
  const { MongoClient, ObjectId } = await import('mongodb');
  const nodemailer = await import('nodemailer');

  const PROTO_PATH = './notification.proto';

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const notificationProto = grpc.loadPackageDefinition(packageDefinition).NotificationService;
  const main = (await import('./server.js')).default; // Adjust the path if necessary

  describe('gRPC Microservice Tests', () => {
    let client;
    let server;
    let ordersCollection;
    let usersCollection;
    let findOneStub;
    let sendMailStub;

    before(async () => {
      // Initialize MongoDB client and collections
      const mongoClient = new MongoClient('mongodb+srv://gotul:gotul@gofinal.e7pap0d.mongodb.net/');
      await mongoClient.connect();
      const database = mongoClient.db('pizzeria');
      ordersCollection = database.collection('orders');
      usersCollection = database.collection('users');

      // Start gRPC server
      server = new grpc.Server();
      server.addService(notificationProto.service, { NotifyOrderReady: notifyOrderReady });
      server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
        server.start();
      });

      client = new notificationProto('localhost:50051', grpc.credentials.createInsecure());
    });

    after(() => {
      server.tryShutdown();
    });

    describe('Unit Tests', () => {
      beforeEach(() => {
        findOneStub = sinon.stub();
        sendMailStub = sinon.stub(nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'bsaulebay@gmail.com',
            pass: 'qjok eayc iagw bbdj',
          },
        }), 'sendMail');
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should connect to MongoDB', async () => {
        const mongoConnectStub = sinon.stub(MongoClient.prototype, 'connect').resolves();
        await main();
        expect(mongoConnectStub.calledOnce).to.be.true;
        mongoConnectStub.restore();
      });

      it('should return Order not found if the order does not exist', async () => {
        findOneStub.resolves(null);
        const callback = sinon.stub();
        await notifyOrderReady({ request: { order_id: 'nonexistent' } }, callback);
        expect(callback.calledWith(null, { message: 'Order not found' })).to.be.true;
      });

      it('should return User not found if the user does not exist', async () => {
        findOneStub.onFirstCall().resolves({ user_id: 'userid' });
        findOneStub.onSecondCall().resolves(null);
        const callback = sinon.stub();
        await notifyOrderReady({ request: { order_id: 'orderid' } }, callback);
        expect(callback.calledWith(null, { message: 'User not found or email not provided' })).to.be.true;
      });

      it('should send email notification if order and user are found', async () => {
        findOneStub.onFirstCall().resolves({ user_id: 'userid' });
        findOneStub.onSecondCall().resolves({ email: 'user@example.com' });
        sendMailStub.yields(null, { response: 'sent' });
        const callback = sinon.stub();
        await notifyOrderReady({ request: { order_id: 'orderid' } }, callback);
        expect(sendMailStub.calledOnce).to.be.true;
      });

      it('should send an email successfully', (done) => {
        sendMailStub.yields(null, { response: 'Email sent' });
        sendEmailNotification('test@example.com', { _id: 'orderid' }, (error, response) => {
          expect(response).to.eql({ message: 'Email sent successfully' });
          done();
        });
      });

      it('should return error if email sending fails', (done) => {
        sendMailStub.yields(new Error('Failed to send email'), null);
        sendEmailNotification('test@example.com', { _id: 'orderid' }, (error, response) => {
          expect(error).to.be.an('error');
          done();
        });
      });

      it('should initialize gRPC server and bind to port 50051', () => {
        const bindAsyncStub = sinon.stub(server, 'bindAsync').yields(null, 0);
        server.start();
        expect(bindAsyncStub.calledWith('0.0.0.0:50051')).to.be.true;
        bindAsyncStub.restore();
      });

      it('should return User not found or email not provided if user email is missing', async () => {
        findOneStub.onFirstCall().resolves({ user_id: 'userid' });
        findOneStub.onSecondCall().resolves({});
        const callback = sinon.stub();
        await notifyOrderReady({ request: { order_id: 'orderid' } }, callback);
        expect(callback.calledWith(null, { message: 'User not found or email not provided' })).to.be.true;
      });

      it('should handle errors from MongoDB', async () => {
        findOneStub.throws(new Error('MongoDB error'));
        const callback = sinon.stub();
        await notifyOrderReady({ request: { order_id: 'orderid' } }, callback);
        expect(callback.calledOnce).to.be.true;
      });

      it('should return error for invalid email address', (done) => {
        sendEmailNotification('invalid-email', { _id: 'orderid' }, (error, response) => {
          expect(error).to.be.an('error');
          done();
        });
      });
    });

    describe('Integration Tests', () => {
      it('should return notification response for valid order ID', (done) => {
        client.NotifyOrderReady({ order_id: 'validOrderId' }, (error, response) => {
          expect(response).to.have.property('message');
          done();
        });
      });

      it('should return Order not found for invalid order ID', (done) => {
        client.NotifyOrderReady({ order_id: 'invalidOrderId' }, (error, response) => {
          expect(response.message).to.equal('Order not found');
          done();
        });
      });

      it('should return User not found for valid order but invalid user', (done) => {
        client.NotifyOrderReady({ order_id: 'orderWithInvalidUser' }, (error, response) => {
          expect(response.message).to.equal('User not found or email not provided');
          done();
        });
      });

      it('should send email successfully for valid order and user', (done) => {
        client.NotifyOrderReady({ order_id: 'orderWithValidUser' }, (error, response) => {
          expect(response.message).to.equal('Email sent successfully');
          done();
        });
      });

      it('should handle server errors gracefully', (done) => {
        client.NotifyOrderReady({ order_id: 'triggerServerError' }, (error, response) => {
          expect(error).to.be.an('error');
          done();
        });
      });
    });
  })
})();
