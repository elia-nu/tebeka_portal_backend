const fs = require('fs');

const collection = JSON.parse(fs.readFileSync('Tebeka_User_Service_Postman_Collection.json', 'utf8'));

function extractRequests(items, folderPath = '') {
  let requests = [];
  for (const item of items) {
    const currentPath = folderPath ? `${folderPath} > ${item.name}` : item.name;
    if (item.item) {
      requests = requests.concat(extractRequests(item.item, currentPath));
    } else if (item.request) {
      requests.push({
        folder: folderPath,
        name: item.name,
        method: item.request.method,
        url: item.request.url
      });
    }
  }
  return requests;
}

const allRequests = extractRequests(collection.item || []);
console.log(`Total requests found: ${allRequests.length}`);
console.log('Sample requests:');
console.log(JSON.stringify(allRequests.slice(0, 10), null, 2));
