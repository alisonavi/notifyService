const { MongoClient, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');

const uri = 'mongodb+srv://gotul:gotul@gofinal.e7pap0d.mongodb.net/';

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db('pizzeria');
    const ordersCollection = database.collection('orders');
    const usersCollection = database.collection('users');

    // Watch for changes in the orders collection
    const changeStream = ordersCollection.watch();

    changeStream.on('change', async (change) => {
      console.log('Change detected:', change);
      if (change.operationType === 'update') {
        const updatedFields = change.updateDescription.updatedFields;
        console.log('Updated fields:', updatedFields);

        if (updatedFields.status === 'Ready') {
          const orderId = change.documentKey._id;
          const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
          console.log('Order found:', order);

          const user = await usersCollection.findOne({ _id: new ObjectId(order.user_id) });
          console.log('User found:', user);
          if (user && user.email) {
            sendEmailNotification(user.email, order);
          }
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
}

function sendEmailNotification(email, order) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'bsaulebay@gmail.com', // Replace with your Gmail address
      pass: 'qjok eayc iagw bbdj' // Replace with your app password
    }
  });

  const mailOptions = {
    from: 'bsaulebay@gmail.com',
    to: email,
    subject: 'Order Ready for Collection',
    text: `Your order with ID ${order._id} is ready to pick up. Enjoy your meal! 🍕🎉`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Email sent: ' + info.response);
  });
}

main().catch(console.error);
