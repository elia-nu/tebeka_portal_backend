const { sanitizeUser } = require('../apps/user-service/src/modules/users/users.service');

function runSanitizeTest() {
  console.log('Testing sanitizeUser utility...');

  const rawUser = {
    id: 'usr-123',
    email: 'test@tebeka.et',
    passwordHash: 'secret_scrypt_hash_12345',
    role: 'ATTORNEY',
    name: 'Test User'
  };

  const sanitized = sanitizeUser(rawUser);
  console.log('Sanitized single user:', sanitized);

  if ('passwordHash' in sanitized) {
    throw new Error('FAILED: passwordHash still present in single user object!');
  }

  const rawList = [
    { id: 'usr-1', passwordHash: 'hash1' },
    { id: 'usr-2', passwordHash: 'hash2' }
  ];

  const sanitizedList = sanitizeUser(rawList);
  console.log('Sanitized list:', sanitizedList);

  for (const item of sanitizedList) {
    if ('passwordHash' in item) {
      throw new Error('FAILED: passwordHash still present in list item!');
    }
  }

  const nestedAttorney = {
    id: 'att-1',
    user: {
      id: 'usr-1',
      passwordHash: 'hash123',
      name: 'Attorney Name'
    }
  };

  const sanitizedAttorney = sanitizeUser(nestedAttorney);
  console.log('Sanitized nested attorney:', sanitizedAttorney);

  if ('passwordHash' in sanitizedAttorney.user) {
    throw new Error('FAILED: passwordHash still present in nested attorney user!');
  }

  console.log('✅ ALL SANITIZATION TESTS PASSED! passwordHash is 100% excluded.');
}

runSanitizeTest();
