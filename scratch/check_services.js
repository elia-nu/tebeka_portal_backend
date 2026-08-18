const net = require('net');

const ports = [
  { name: 'API Gateway', port: 3000 },
  { name: 'User Service', port: 3001 },
  { name: 'Marketplace Service', port: 3002 },
  { name: 'Financial Service', port: 3003 },
  { name: 'Communication Service', port: 3004 },
  { name: 'PostgreSQL', port: 5432 },
  { name: 'Redis', port: 6379 },
  { name: 'RabbitMQ', port: 5672 },
  { name: 'MongoDB', port: 27017 }
];

async function checkPort(service) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve({ service: service.name, port: service.port, status: 'OPEN' });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ service: service.name, port: service.port, status: 'CLOSED/TIMEOUT' });
    });
    socket.on('error', () => {
      resolve({ service: service.name, port: service.port, status: 'CLOSED' });
    });
    socket.connect(service.port, '127.0.0.1');
  });
}

async function run() {
  const results = await Promise.all(ports.map(checkPort));
  console.log(JSON.stringify(results, null, 2));
}

run();
