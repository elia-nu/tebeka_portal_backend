// Script to update Postman collection with attorneys/me/* token-based routes
const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, 'Tebeka_User_Service_Postman_Collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

// Helper to build a Postman request item
function makeItem(name, method, rawUrl, body, auth = true) {
  const urlParts = rawUrl.replace('{{baseUrl}}/', '').split('/');
  const item = {
    name,
    request: {
      method,
      header: auth
        ? [{ key: 'Authorization', value: 'Bearer {{accessToken}}', type: 'text' }]
        : [],
      url: {
        raw: rawUrl,
        host: ['{{baseUrl}}'],
        path: urlParts,
      },
    },
    response: [],
  };

  if (body) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
    item.request.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  return item;
}

// ── New "Attorney Me (Token-Based)" folder ──
const attorneyMeFolder = {
  name: '03b. Attorney Self-Service (Token-Based /attorneys/me)',
  description:
    'All attorney self-service endpoints that resolve the attorney profile from the Bearer token. No attorney profile ID needed in the URL.',
  item: [
    // Profile
    makeItem(
      '3b.1 GET My Attorney Profile',
      'GET',
      '{{baseUrl}}/attorneys/me',
      null
    ),
    makeItem(
      '3b.2 PATCH Update My Attorney Profile',
      'PATCH',
      '{{baseUrl}}/attorneys/me',
      {
        bioEn: 'Experienced corporate lawyer with 10+ years of practice in Ethiopian commercial law, specializing in mergers, acquisitions, and regulatory compliance.',
        city: 'Addis Ababa',
        languages: ['en', 'am'],
        experienceYears: 10,
      }
    ),
    makeItem(
      '3b.3 PATCH Publish My Profile',
      'PATCH',
      '{{baseUrl}}/attorneys/me/publish',
      null
    ),
    makeItem(
      '3b.4 PATCH Hide My Profile',
      'PATCH',
      '{{baseUrl}}/attorneys/me/hide',
      null
    ),

    // Credentials
    makeItem(
      '3b.5 GET My Public Credentials',
      'GET',
      '{{baseUrl}}/attorneys/me/credentials-public',
      null
    ),

    // Education
    makeItem(
      '3b.6 POST Add My Education',
      'POST',
      '{{baseUrl}}/attorneys/me/education',
      {
        degree: 'LLB',
        institution: 'Addis Ababa University',
        fieldOfStudy: 'Law',
        graduationYear: 2020,
      }
    ),
    makeItem(
      '3b.7 GET My Education Records',
      'GET',
      '{{baseUrl}}/attorneys/me/education',
      null
    ),
    makeItem(
      '3b.8 DELETE Remove My Education Record',
      'DELETE',
      '{{baseUrl}}/attorneys/me/education/{{educationId}}',
      null
    ),

    // Availability
    makeItem(
      '3b.9 GET My Availability',
      'GET',
      '{{baseUrl}}/attorneys/me/availability',
      null
    ),
    makeItem(
      '3b.10 POST Create Availability Slot',
      'POST',
      '{{baseUrl}}/attorneys/me/availability',
      {
        weekday: 1,
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Africa/Addis_Ababa',
        isAvailable: true,
      }
    ),
    makeItem(
      '3b.11 PATCH Update Availability Slot',
      'PATCH',
      '{{baseUrl}}/attorneys/me/availability/{{availabilityId}}',
      {
        startTime: '10:00',
        endTime: '18:00',
      }
    ),
    makeItem(
      '3b.12 DELETE Remove Availability Slot',
      'DELETE',
      '{{baseUrl}}/attorneys/me/availability/{{availabilityId}}',
      null
    ),
    makeItem(
      '3b.13 POST Block a Date',
      'POST',
      '{{baseUrl}}/attorneys/me/block-date',
      {
        date: '2026-09-15',
        reason: 'Court hearing',
      }
    ),
    makeItem(
      '3b.14 POST Set Vacation Period',
      'POST',
      '{{baseUrl}}/attorneys/me/vacation',
      {
        startDate: '2026-12-20',
        endDate: '2027-01-05',
        reason: 'Holiday break',
      }
    ),

    // Practice Areas
    makeItem(
      '3b.15 POST Assign Practice Area to Me',
      'POST',
      '{{baseUrl}}/attorneys/me/practice-areas',
      {
        practiceAreaId: 'pa-1',
      }
    ),
    makeItem(
      '3b.16 DELETE Remove My Practice Area',
      'DELETE',
      '{{baseUrl}}/attorneys/me/practice-areas/{{practiceAreaId}}',
      null
    ),

    // Profile Changes
    makeItem(
      '3b.17 POST Request Guarded Profile Change',
      'POST',
      '{{baseUrl}}/attorneys/me/request-profile-change',
      {
        feeBand: 'TIER_2',
        barRegistrationNumber: 'BAR-2026-12345',
      }
    ),
    makeItem(
      '3b.18 GET My Pending Profile Changes',
      'GET',
      '{{baseUrl}}/attorneys/me/pending-profile-changes',
      null
    ),
  ],
};

// Insert the new folder after section 03 (index 2)
const section03Index = collection.item.findIndex((f) =>
  f.name.startsWith('03.')
);
if (section03Index !== -1) {
  // Check if 03b already exists and remove it
  const existing03bIndex = collection.item.findIndex((f) =>
    f.name.startsWith('03b.')
  );
  if (existing03bIndex !== -1) {
    collection.item.splice(existing03bIndex, 1);
  }
  // Re-find 03 index after possible removal
  const newSection03Index = collection.item.findIndex((f) =>
    f.name.startsWith('03.')
  );
  collection.item.splice(newSection03Index + 1, 0, attorneyMeFolder);
} else {
  collection.item.push(attorneyMeFolder);
}

// Also update section 03 items to note they use :id (admin routes)
const section03 = collection.item.find((f) => f.name.startsWith('03.'));
if (section03) {
  section03.description =
    section03.description +
    '\n\nNote: These endpoints use attorney profile ID in the URL. For token-based self-service endpoints, see section "03b. Attorney Self-Service (Token-Based /attorneys/me)".';
}

// Update the environment file to add new variables
const envPath = path.join(__dirname, 'Tebeka_User_Service_Postman_Environment.json');
const env = JSON.parse(fs.readFileSync(envPath, 'utf8'));

const newVars = [
  { key: 'educationId', value: '', type: 'default', enabled: true },
  { key: 'availabilityId', value: '', type: 'default', enabled: true },
  { key: 'practiceAreaId', value: 'pa-1', type: 'default', enabled: true },
];

for (const nv of newVars) {
  if (!env.values.find((v) => v.key === nv.key)) {
    env.values.push(nv);
  }
}

// Write back
fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8');
fs.writeFileSync(envPath, JSON.stringify(env, null, 2), 'utf8');

console.log('✅ Postman Collection updated with "03b. Attorney Self-Service (Token-Based /attorneys/me)" folder');
console.log(`   Added ${attorneyMeFolder.item.length} requests`);
console.log('✅ Postman Environment updated with educationId, availabilityId, practiceAreaId variables');
