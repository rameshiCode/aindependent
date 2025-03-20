const fs = require('fs');

// Read the OpenAPI JSON file
const openapi = JSON.parse(fs.readFileSync('./openapi.json', 'utf-8'));

// Function to replace hyphens in operation IDs with underscores
function fixOperationIds(obj) {
  if (!obj || typeof obj !== 'object') return;

  // Look for operationId property and fix it
  if (obj.operationId && typeof obj.operationId === 'string') {
    obj.operationId = obj.operationId.replace(/-/g, '_');
  }

  // Recursively process all child properties
  Object.values(obj).forEach(val => fixOperationIds(val));
}

// Fix the operation IDs
fixOperationIds(openapi);

// Write the fixed OpenAPI JSON back to the file
fs.writeFileSync('./openapi.json', JSON.stringify(openapi, null, 2));

console.log('Fixed OpenAPI JSON file');
