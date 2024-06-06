const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { MongoClient, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');

const PROTO_PATH = './notification.proto';
const uri = 'mongodb+srv://gotul:gotul@gofinal.e7pap0d.mongodb.net/';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition).NotificationService;

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db('pizzeria');
    const ordersCollection = database.collection('orders');
    const usersCollection = database.collection('users');

    async function notifyOrderReady(call, callback) {
      const orderId = call.request.order_id;
      const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });

      if (!order) {
        return callback(null, { message: 'Order not found' });
      }

      const user = await usersCollection.findOne({ _id: new ObjectId(order.user_id) });
      if (user && user.email) {
        sendEmailNotification(user.email, order, callback);
      } else {
        callback(null, { message: 'User not found or email not provided' });
      }
    }

    function sendEmailNotification(email, order, callback) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'bsaulebay@gmail.com', // Replace with your Gmail address
          pass: 'qjok eayc iagw bbdj', // Replace with your app password
        },
      });

      const mailOptions = {
        from: 'bsaulebay@gmail.com',
        to: email,
        subject: 'Order Ready for Collection',
        text: `Your order with ID ${order._id} is ready to pick up. Enjoy your meal! 🍕🎉`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return callback(error, null);
        }
        console.log('Email sent: ' + info.response);
        callback(null, { message: 'Email sent successfully' });
      });
    }

    const server = new grpc.Server();
    server.addService(notificationProto.service, { NotifyOrderReady: notifyOrderReady });
    server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
      console.log('gRPC server running at http://0.0.0.0:50051');
    });
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
