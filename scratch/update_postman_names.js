const fs = require('fs');
const path = require('path');

const collectionPath = path.resolve(__dirname, '../Tebeka_User_Service_Postman_Collection.json');

if (fs.existsSync(collectionPath)) {
  const content = fs.readFileSync(collectionPath, 'utf8');
  let collection = JSON.parse(content);

  let updated = false;

  function updateItem(item) {
    if (item.name && item.name.toLowerCase().includes('attorney') && item.request && item.request.body) {
      const body = item.request.body;

      if (body.mode === 'formdata' && Array.isArray(body.formdata)) {
        // Replace 'name' entry with 'firstName', 'middleName', 'surName'
        const hasFirstName = body.formdata.some(f => f.key === 'firstName');
        if (!hasFirstName) {
          const nameIndex = body.formdata.findIndex(f => f.key === 'name');
          const newFields = [
            { key: 'firstName', value: 'Dawit', type: 'text', description: 'First Name' },
            { key: 'middleName', value: 'Solomon', type: 'text', description: 'Middle Name' },
            { key: 'surName', value: 'Desalegn', type: 'text', description: 'Surname / Last Name' }
          ];

          if (nameIndex !== -1) {
            body.formdata.splice(nameIndex, 1, ...newFields);
          } else {
            body.formdata.unshift(...newFields);
          }
          updated = true;
        }
      } else if (body.mode === 'raw' && typeof body.raw === 'string') {
        try {
          const json = JSON.parse(body.raw);
          if (json.name && !json.firstName) {
            delete json.name;
            json.firstName = 'Dawit';
            json.middleName = 'Solomon';
            json.surName = 'Desalegn';
            body.raw = JSON.stringify(json, null, 4);
            updated = true;
          }
        } catch (e) {}
      }
    }

    if (Array.isArray(item.item)) {
      item.item.forEach(updateItem);
    }
  }

  if (Array.isArray(collection.item)) {
    collection.item.forEach(updateItem);
  }

  if (updated) {
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
    console.log('✅ Postman Collection updated with firstName, middleName, and surName fields.');
  } else {
    console.log('Postman Collection already up to date.');
  }
} else {
  console.log('Postman Collection file not found.');
}
