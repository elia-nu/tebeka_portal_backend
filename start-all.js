const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const services = [
  { name: 'FINANCIAL', color: '\x1b[32m', project: 'financial-service' },
  { name: 'COMMUNICATION', color: '\x1b[35m', project: 'communication-service' },
  { name: 'MARKETPLACE', color: '\x1b[33m', project: 'marketplace-service' },
  { name: 'USER-SERVICE', color: '\x1b[34m', project: 'user-service' },
  { name: 'API-GATEWAY', color: '\x1b[36m', project: 'api-gateway' },
];

console.log('\x1b[1m\x1b[37m========================================================================\x1b[0m');
console.log('\x1b[1m\x1b[32m  🚀 STARTING ALL TEBEKA MICROSERVICES & API GATEWAY                  \x1b[0m');
console.log('\x1b[1m\x1b[37m========================================================================\x1b[0m\n');

const runningProcesses = [];

function startService(svc, delayMs) {
  setTimeout(() => {
    const prefix = `${svc.color}[${svc.name.padEnd(13)}]\x1b[0m `;
    console.log(`${prefix}\x1b[90mStarting ${svc.project}...\x1b[0m`);

    const proc = spawn(npxCmd, ['nx', 'serve', svc.project], {
      cwd: path.resolve(__dirname),
      env: {
        ...process.env,
        FORCE_COLOR: 'true',
        TS_NODE_TRANSPILE_ONLY: 'true',
        NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=4096',
      },
      shell: isWin,
    });

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`${prefix}${line}`);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.error(`${prefix}\x1b[31m${line}\x1b[0m`);
        }
      }
    });

    proc.on('close', (code) => {
      console.log(`${prefix}\x1b[33mProcess exited with code ${code}\x1b[0m`);
    });

    runningProcesses.push(proc);
  }, delayMs);
}

// Start core services first, then Gateway
services.forEach((svc, index) => {
  startService(svc, index * 2000);
});

function cleanup() {
  console.log('\n\x1b[33mShutting down all services...\x1b[0m');
  for (const p of runningProcesses) {
    try {
      if (isWin) {
        spawn('taskkill', ['/pid', p.pid, '/f', '/t']);
      } else {
        p.kill('SIGINT');
      }
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
