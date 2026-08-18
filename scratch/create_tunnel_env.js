const fs = require('fs');

const env = JSON.parse(fs.readFileSync('Tebeka_User_Service_Postman_Environment.json', 'utf8'));

const tunnelUrl = 'https://jones-homeland-sentence-urgent.trycloudflare.com/api/v1';

env.name = 'Tebeka Cloudflare Tunnel Environment';
env.values.forEach(v => {
  if (v.key === 'baseUrl' || v.key === 'marketplaceUrl') {
    v.value = tunnelUrl;
  }
});

fs.writeFileSync('scratch/tunnel_environment.json', JSON.stringify(env, null, 2));
console.log('Created scratch/tunnel_environment.json with tunnel URL:', tunnelUrl);
