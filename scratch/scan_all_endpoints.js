const fs = require('fs');
const path = require('path');

const APPS_DIR = 'apps';

// Find all .controller.ts files
function findControllers(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findControllers(fullPath, results);
    } else if (entry.name.endsWith('.controller.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const controllers = findControllers(APPS_DIR);

const httpMethods = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const methodRegex = new RegExp(`@(${httpMethods.join('|')})\\(([^)]*)\\)`, 'g');
const controllerRegex = /@Controller\(([^)]*)\)/;

const allEndpoints = [];

for (const file of controllers) {
  const content = fs.readFileSync(file, 'utf8');

  // Extract controller base path
  const controllerMatch = content.match(controllerRegex);
  let basePath = '';
  if (controllerMatch && controllerMatch[1]) {
    basePath = controllerMatch[1].replace(/['"]/g, '').trim();
  }

  // Extract each HTTP method endpoint
  let match;
  const regex = new RegExp(`@(${httpMethods.join('|')})\\(([^)]*)\\)`, 'g');
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let routePath = match[2].replace(/['"]/g, '').trim();

    // Find the method name (next function declaration)
    const afterDecorator = content.substring(match.index);
    const fnMatch = afterDecorator.match(/(?:async\s+)?(\w+)\s*\(/);
    const fnName = fnMatch ? fnMatch[1] : 'unknown';

    // Check for guards/decorators
    const surroundingCode = content.substring(Math.max(0, match.index - 300), match.index + 200);
    const hasAuth = surroundingCode.includes('@UseGuards') || surroundingCode.includes('JwtAuthGuard') || surroundingCode.includes('RolesGuard');
    const rolesMatch = surroundingCode.match(/@Roles\(([^)]+)\)/);
    const roles = rolesMatch ? rolesMatch[1].replace(/['"]/g, '').trim() : '';

    const fullPath = basePath ? `/${basePath}${routePath ? '/' + routePath : ''}` : `/${routePath}`;

    allEndpoints.push({
      file: file.replace(/\\/g, '/'),
      service: file.split(/[\\/]/)[1],
      controller: basePath || '(root)',
      method,
      path: fullPath.replace(/\/+/g, '/'),
      functionName: fnName,
      requiresAuth: hasAuth,
      roles: roles
    });
  }
}

// Sort by service then path
allEndpoints.sort((a, b) => {
  if (a.service !== b.service) return a.service.localeCompare(b.service);
  return a.path.localeCompare(b.path);
});

console.log(`Total endpoints found: ${allEndpoints.length}\n`);

// Group by service
const byService = {};
for (const ep of allEndpoints) {
  if (!byService[ep.service]) byService[ep.service] = [];
  byService[ep.service].push(ep);
}

for (const [service, endpoints] of Object.entries(byService)) {
  console.log(`\n=== ${service} (${endpoints.length} endpoints) ===`);
  for (const ep of endpoints) {
    const authLabel = ep.requiresAuth ? `[AUTH${ep.roles ? ': ' + ep.roles : ''}]` : '[PUBLIC]';
    console.log(`  ${ep.method.padEnd(7)} ${ep.path.padEnd(60)} ${authLabel}  (${ep.functionName})`);
  }
}

// Now compare with existing Postman collection
const collection = JSON.parse(fs.readFileSync('Tebeka_User_Service_Postman_Collection.json', 'utf8'));

function extractPostmanPaths(items) {
  let paths = [];
  for (const item of items) {
    if (item.item) {
      paths = paths.concat(extractPostmanPaths(item.item));
    } else if (item.request) {
      const rawUrl = typeof item.request.url === 'string' ? item.request.url : (item.request.url.raw || '');
      const method = item.request.method;
      // Normalize: remove {{baseUrl}} and {{marketplaceUrl}}
      const normalizedPath = rawUrl
        .replace(/\{\{baseUrl\}\}/g, '')
        .replace(/\{\{marketplaceUrl\}\}/g, '')
        .replace(/\?.*$/, '') // remove query params
        .replace(/\/+/g, '/')
        .replace(/^\/?/, '/');
      paths.push({ method, path: normalizedPath, name: item.name });
    }
  }
  return paths;
}

const postmanPaths = extractPostmanPaths(collection.item || []);

// Find missing endpoints
console.log(`\n\n========== MISSING FROM POSTMAN COLLECTION ==========`);
console.log(`Postman has ${postmanPaths.length} requests`);
console.log(`Codebase has ${allEndpoints.length} endpoints\n`);

function normalizeForCompare(p) {
  return p
    .replace(/:[a-zA-Z]+/g, match => `{{${match.slice(1)}}}`)  // :id -> {{id}}
    .replace(/\/+/g, '/')
    .replace(/^\/?/, '/')
    .replace(/\/$/, '');
}

const postmanSet = new Set(postmanPaths.map(p => `${p.method} ${normalizeForCompare(p.path)}`));

const missing = [];
for (const ep of allEndpoints) {
  const normalized = normalizeForCompare(ep.path);
  const key = `${ep.method} ${normalized}`;
  const found = postmanSet.has(key) || postmanPaths.some(p => {
    const pNorm = normalizeForCompare(p.path);
    return p.method === ep.method && (pNorm === normalized || pNorm.endsWith(normalized) || normalized.endsWith(pNorm));
  });
  if (!found) {
    missing.push(ep);
  }
}

console.log(`Missing endpoints: ${missing.length}\n`);
for (const ep of missing) {
  console.log(`  ${ep.method.padEnd(7)} ${ep.path.padEnd(60)} [${ep.service}] (${ep.functionName})`);
}

fs.writeFileSync('scratch/all_endpoints.json', JSON.stringify(allEndpoints, null, 2));
fs.writeFileSync('scratch/missing_endpoints.json', JSON.stringify(missing, null, 2));
console.log(`\nSaved to scratch/all_endpoints.json and scratch/missing_endpoints.json`);
