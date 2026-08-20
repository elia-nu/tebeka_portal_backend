const http = require('http');
const readline = require('readline');

const endpoints = [
  { name: 'Gateway Health', service: 'Gateway', port: 5000, method: 'GET', path: '/api/v1/health', desc: 'Overall API Gateway health check' },
  { name: 'User Profile Check', service: 'User', port: 3001, method: 'GET', path: '/api/v1/verifications/my-case', desc: 'Attorney case verification review view' },
  { name: 'Public Legal Blogs', service: 'User', port: 3001, method: 'GET', path: '/api/v1/blogs', desc: 'Public legal articles list' },
  { name: 'Attorney Discovery', service: 'Marketplace', port: 3002, method: 'GET', path: '/api/v1/discovery/attorneys', desc: 'Tiered attorney marketplace directory' },
  { name: 'Bookings List', service: 'Marketplace', port: 3002, method: 'GET', path: '/api/v1/bookings', desc: 'Consultation bookings listing' },
  { name: 'Ethiopian Banks List', service: 'Financial', port: 3003, method: 'GET', path: '/api/v1/financial/payments/banks', desc: 'Commercial banks & Telebirr directory' },
  { name: 'Payments Ledger', service: 'Financial', port: 3003, method: 'GET', path: '/api/v1/financial/payments', desc: 'Transaction history & escrow ledger' },
  { name: 'Notification Templates', service: 'Communication', port: 3004, method: 'GET', path: '/api/v1/communication/notification-templates', desc: 'Bilingual email/SMS template engine' },
  { name: 'User Conversations', service: 'Communication', port: 3004, method: 'GET', path: '/api/v1/communication/conversations', desc: 'Real-time chat & consultation threads' },
  { name: 'System Prometheus Metrics', service: 'Metrics', port: 3001, method: 'GET', path: '/api/v1/metrics', desc: 'System uptime, latency & circuit breaker metrics' }
];

const results = {};

function pingEndpoint(ep) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(
      {
        hostname: 'localhost',
        port: ep.port,
        path: ep.path,
        method: ep.method,
        timeout: 2500,
        headers: { 'User-Agent': 'Tebeka-Live-Tracker/1.0' }
      },
      (res) => {
        const duration = Date.now() - start;
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            duration,
            online: true
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'TIMEOUT', duration: 2500, online: false });
    });

    req.on('error', (err) => {
      resolve({ status: 'OFFLINE', duration: Date.now() - start, online: false });
    });

    req.end();
  });
}

async function updateAll() {
  for (const ep of endpoints) {
    const key = `${ep.port}:${ep.path}`;
    results[key] = await pingEndpoint(ep);
  }
}

function render() {
  console.clear();
  const time = new Date().toLocaleTimeString();

  console.log('\x1b[1m\x1b[36m' + '='.repeat(110) + '\x1b[0m');
  console.log(`\x1b[1m\x1b[37m  📡 TEBEKA LIVE ENDPOINT & TRAFFIC MONITOR  \x1b[0m | \x1b[90mLast Updated: ${time}\x1b[0m | \x1b[32mAuto-refreshing every 2s\x1b[0m`);
  console.log('\x1b[1m\x1b[36m' + '='.repeat(110) + '\x1b[0m\n');

  console.log(`  ${'SERVICE'.padEnd(14)} ${'METHOD'.padEnd(7)} ${'ENDPOINT / PORT'.padEnd(46)} ${'STATUS'.padEnd(16)} ${'LATENCY'.padEnd(10)} DESCRIPTION`);
  console.log('  ' + '-'.repeat(108));

  for (const ep of endpoints) {
    const key = `${ep.port}:${ep.path}`;
    const res = results[key] || { status: 'CHECKING...', duration: 0, online: false };

    let statusDisplay = '';
    if (res.status === 200) {
      statusDisplay = '\x1b[32m✔ 200 OK\x1b[0m';
    } else if (res.status === 401) {
      statusDisplay = '\x1b[33m🔒 401 Auth\x1b[0m';
    } else if (res.status === 404) {
      statusDisplay = '\x1b[31m✖ 404 Not Found\x1b[0m';
    } else if (res.status === 'OFFLINE') {
      statusDisplay = '\x1b[31m⛔ OFFLINE\x1b[0m';
    } else if (res.status === 'TIMEOUT') {
      statusDisplay = '\x1b[31m⏱ TIMEOUT\x1b[0m';
    } else {
      statusDisplay = `\x1b[33m${res.status}\x1b[0m`;
    }

    const latencyStr = res.online ? `${res.duration}ms` : '-';
    const methodFormatted = ep.method === 'GET' ? `\x1b[32m${ep.method}\x1b[0m` : `\x1b[34m${ep.method}\x1b[0m`;
    const fullPathStr = `:${ep.port}${ep.path}`;

    console.log(
      `  \x1b[1m${ep.service.padEnd(14)}\x1b[0m ${methodFormatted.padEnd(16)} \x1b[36m${fullPathStr.padEnd(46)}\x1b[0m ${statusDisplay.padEnd(25)} ${latencyStr.padEnd(10)} \x1b[90m${ep.desc}\x1b[0m`
    );
  }

  console.log('\n\x1b[1m\x1b[36m' + '='.repeat(110) + '\x1b[0m');
  console.log('  \x1b[90mPress \x1b[37mCtrl+C\x1b[90m to exit monitor.\x1b[0m\n');
}

async function loop() {
  await updateAll();
  render();
  setTimeout(loop, 2000);
}

loop();
