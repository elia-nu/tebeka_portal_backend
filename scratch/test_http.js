const http = require('http');

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data.substring(0, 200) }));
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function test() {
  console.log('User service 3001:', await get('http://localhost:3001/api'));
}

test();
