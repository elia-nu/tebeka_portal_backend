const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, 'Tebeka_User_Service_Postman_Collection.json');
const envPath = path.join(__dirname, 'Tebeka_User_Service_Postman_Environment.json');

const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const env = JSON.parse(fs.readFileSync(envPath, 'utf8'));

// 1. Update 5.1.1 POST Upload File to use formdata
function updateStorageUploadFile(items) {
  for (const item of items) {
    if (item.item) {
      updateStorageUploadFile(item.item);
    } else if (item.name && item.name.includes('5.1.1 POST Upload File')) {
      item.request.body = {
        mode: 'formdata',
        formdata: [
          { key: 'file', type: 'file', src: [] },
          { key: 'subDir', value: 'general', type: 'text' }
        ]
      };
      console.log('Updated 5.1.1 POST Upload File to formdata');
    }
  }
}

updateStorageUploadFile(collection.item);

// Helper to find folder by path of names
function findFolder(items, namePrefix) {
  for (const item of items) {
    if (item.name && item.name.startsWith(namePrefix)) {
      return item;
    }
    if (item.item) {
      const found = findFolder(item.item, namePrefix);
      if (found) return found;
    }
  }
  return null;
}

// 2. Add form-data attorney upload endpoints to 3.2 Education & Credentials
const sec32 = findFolder(collection.item, '3.2 Education & Credentials');
if (sec32) {
  // Remove if exists to avoid duplication
  sec32.item = sec32.item.filter(i => !i.name.includes('3.2.5') && !i.name.includes('3.2.6') && !i.name.includes('3.2.7'));

  sec32.item.push({
    name: '3.2.5 POST Upload Attorney Verification Document (form-data)',
    request: {
      method: 'POST',
      header: [],
      url: {
        raw: '{{baseUrl}}/attorneys/me/documents',
        host: ['{{baseUrl}}'],
        path: ['attorneys', 'me', 'documents']
      },
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{attorneyAuthToken}}', type: 'string' }]
      },
      body: {
        mode: 'formdata',
        formdata: [
          { key: 'file', type: 'file', src: [] },
          { key: 'credentialType', value: 'BAR_LICENSE', type: 'text' },
          { key: 'credentialNumber', value: 'BAR-ETH-2026-884', type: 'text' },
          { key: 'issuer', value: 'Federal Ministry of Justice', type: 'text' }
        ]
      }
    },
    response: []
  });

  sec32.item.push({
    name: '3.2.6 GET My Credentials & Uploaded Documents',
    request: {
      method: 'GET',
      header: [],
      url: {
        raw: '{{baseUrl}}/attorneys/me/credentials',
        host: ['{{baseUrl}}'],
        path: ['attorneys', 'me', 'credentials']
      },
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{attorneyAuthToken}}', type: 'string' }]
      }
    },
    response: []
  });

  sec32.item.push({
    name: '3.2.7 DELETE Remove Uploaded Attorney Document',
    request: {
      method: 'DELETE',
      header: [],
      url: {
        raw: '{{baseUrl}}/attorneys/me/documents/{{credentialDocumentId}}',
        host: ['{{baseUrl}}'],
        path: ['attorneys', 'me', 'documents', '{{credentialDocumentId}}']
      },
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{attorneyAuthToken}}', type: 'string' }]
      }
    },
    response: []
  });

  console.log('Added 3.2.5, 3.2.6, 3.2.7 endpoints to Section 3.2 Education & Credentials');
}

// 3. Add 5.1.5 POST Upload Attorney Document by Profile ID to 5.1 File Storage & Upload Service
const sec51 = findFolder(collection.item, '5.1 File Storage & Upload Service');
if (sec51) {
  sec51.item = sec51.item.filter(i => !i.name.includes('5.1.5'));

  sec51.item.push({
    name: '5.1.5 POST Upload Attorney Document by Profile ID (form-data)',
    request: {
      method: 'POST',
      header: [],
      url: {
        raw: '{{baseUrl}}/attorneys/{{attorneyProfileId}}/documents',
        host: ['{{baseUrl}}'],
        path: ['attorneys', '{{attorneyProfileId}}', 'documents']
      },
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAuthToken}}', type: 'string' }]
      },
      body: {
        mode: 'formdata',
        formdata: [
          { key: 'file', type: 'file', src: [] },
          { key: 'credentialType', value: 'BAR_LICENSE', type: 'text' },
          { key: 'credentialNumber', value: 'BAR-ETH-2026-884', type: 'text' },
          { key: 'issuer', value: 'Federal Ministry of Justice', type: 'text' }
        ]
      }
    },
    response: []
  });

  console.log('Added 5.1.5 POST Upload Attorney Document by Profile ID to Section 5.1');
}

// 4. Add 1.1.2b POST Register Attorney Account with Initial Document Files to Section 1.1
const sec11 = findFolder(collection.item, '1.1 Authentication & Self-Registration Service');
if (sec11) {
  sec11.item = sec11.item.filter(i => !i.name.includes('1.1.2b'));

  sec11.item.splice(2, 0, {
    name: '1.1.2b POST Register Attorney Account with Initial Document Files (form-data)',
    request: {
      method: 'POST',
      header: [],
      url: {
        raw: '{{baseUrl}}/auth/register/attorney',
        host: ['{{baseUrl}}'],
        path: ['auth', 'register', 'attorney']
      },
      body: {
        mode: 'formdata',
        formdata: [
          { key: 'phone', value: '+251911998877', type: 'text' },
          { key: 'email', value: 'attorney.intake@tebeka.et', type: 'text' },
          { key: 'password', value: 'AttorneyPass123!', type: 'text' },
          { key: 'name', value: 'Abebe Bikila', type: 'text' },
          { key: 'barRegistrationNumber', value: 'BAR-ETH-2026-999', type: 'text' },
          { key: 'barAdmissionYear', value: '2020', type: 'text' },
          { key: 'otpContinuationToken', value: 'tok-verified-phone-otp', type: 'text' },
          { key: 'licenseBookUrl', value: 'credentials/license_book.pdf', type: 'text' },
          { key: 'barRegistrationUrl', value: 'credentials/bar_cert.pdf', type: 'text' },
          { key: 'nationalIdDocumentUrl', value: 'credentials/national_id.pdf', type: 'text' }
        ]
      }
    },
    response: []
  });

  console.log('Added 1.1.2b POST Register Attorney Account with Initial Document Files to Section 1.1');
}

// 5. Ensure Environment variables exist
const newVars = [
  { key: 'credentialDocumentId', value: '', type: 'default', enabled: true },
];
for (const nv of newVars) {
  if (!env.values.find((v) => v.key === nv.key)) {
    env.values.push(nv);
  }
}

// Save back
fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
fs.writeFileSync(envPath, JSON.stringify(env, null, 2), 'utf8');

console.log('✅ Postman Collection & Environment updated with form-data upload payloads successfully!');
