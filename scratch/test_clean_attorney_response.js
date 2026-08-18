const { sanitizeUser } = require('../apps/user-service/src/modules/users/users.service');

function testSanitize() {
  console.log('Testing sanitizeUser on full attorney profile response...');

  const rawAttorney = {
    id: "b317daa6-cccc-4854-bdda-7602d37d82d9",
    userId: "ac08d77e-bd39-44bb-9cd3-5e60174b78e3",
    country: "Ethiopia",
    barRegistrationNumber: "BAR-ETH-2026-999",
    user: {
      id: "ac08d77e-bd39-44bb-9cd3-5e60174b78e3",
      email: "abeldesalegn97@gmail.com",
      passwordHash: "secret_hash",
      name: "Dawit Solomon"
    },
    verificationCases: [
      {
        id: "75fc7169-bd27-4548-95aa-1492f011ca36",
        attorneyId: "b317daa6-cccc-4854-bdda-7602d37d82d9",
        status: "SUBMITTED"
      }
    ],
    credentials: [
      {
        id: "85beec3b-4646-42dd-aed8-aa6b0bd50c67",
        attorneyId: "b317daa6-cccc-4854-bdda-7602d37d82d9",
        credentialType: "BAR_LICENSE",
        documents: [
          {
            id: "3aead61e-b90c-4a83-9975-2a4984c45c8c",
            credentialId: "85beec3b-4646-42dd-aed8-aa6b0bd50c67",
            fileKey: "credentials/file.pdf"
          }
        ]
      }
    ]
  };

  const sanitized = sanitizeUser(rawAttorney);
  console.log('Cleaned Response Output:');
  console.log(JSON.stringify(sanitized, null, 2));

  // Assertions
  if ('passwordHash' in sanitized.user) {
    throw new Error('FAILED: passwordHash still present');
  }
  if ('attorneyId' in sanitized.verificationCases[0]) {
    throw new Error('FAILED: attorneyId still present in verificationCase');
  }
  if ('attorneyId' in sanitized.credentials[0]) {
    throw new Error('FAILED: attorneyId still present in credential');
  }
  if ('credentialId' in sanitized.credentials[0].documents[0]) {
    throw new Error('FAILED: credentialId still present in document');
  }

  console.log('✅ ALL REDUNDANCY REMOVAL TESTS PASSED!');
}

testSanitize();
