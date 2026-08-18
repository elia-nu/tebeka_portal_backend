const fs = require('fs');
const path = require('path');
const newman = require('newman');

const collectionPath = path.join(__dirname, '../Tebeka_User_Service_Postman_Collection.json');
const environmentPath = path.join(__dirname, '../Tebeka_User_Service_Postman_Environment.json');

const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));

// Inject bypass-tunnel-reminder header to all requests
function injectHeader(items) {
  for (const item of items) {
    if (item.item) {
      injectHeader(item.item);
    } else if (item.request) {
      item.request.header = item.request.header || [];
      item.request.header.push({
        key: 'bypass-tunnel-reminder',
        value: 'true',
        type: 'text'
      });
    }
  }
}

injectHeader(collection.item);

const tunnelUrl = 'https://modern-pandas-refuse.loca.lt/api/v1';
console.log(`Starting Newman execution against Tunnel URL: ${tunnelUrl}`);

newman.run({
  collection: collection,
  environment: environment,
  envVar: [
    { key: 'baseUrl', value: tunnelUrl }
  ],
  reporters: 'cli'
}, function (err, summary) {
  if (err) {
    console.error('Newman execution error:', err);
    process.exit(1);
  }
  console.log('\n========================================');
  console.log('Newman Tunnel Test Execution Complete!');
  console.log(`Total Requests: ${summary.run.stats.requests.total}`);
  console.log(`Failed Requests: ${summary.run.stats.requests.failed}`);
  console.log('========================================\n');
});
