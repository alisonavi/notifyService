const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = './notification.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition).NotificationService;

function main() {
  const client = new notificationProto('localhost:50051', grpc.credentials.createInsecure());

  client.NotifyOrderReady({ order_id: '6660f24a5fe223cf5a041169' }, (error, response) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    console.log('Notification Response:', response.message);
  });
}

main();
