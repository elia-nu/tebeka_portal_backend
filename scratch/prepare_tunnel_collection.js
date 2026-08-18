const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, '../Tebeka_User_Service_Postman_Collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

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

const outputPath = path.join(__dirname, 'tunnel_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
console.log('Created tunnel_collection.json successfully');
