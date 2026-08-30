import { LUNA_OPENAPI_SPEC, LUNA_CORE_OPENAPI_SPEC, LUNA_DEV_OPENAPI_SPEC } from './mcp-server/dist/openapi.js';
import fs from 'fs';

fs.mkdirSync('./public', { recursive: true });

// Unified (27 operations)
fs.writeFileSync('./public/openapi.json', JSON.stringify(LUNA_OPENAPI_SPEC, null, 2));
fs.writeFileSync('/mnt/c/Users/Ben/.gemini/antigravity/brain/d17495c6-118d-4194-a670-649f09d34237/scratch/openapi.json', JSON.stringify(LUNA_OPENAPI_SPEC, null, 2));

// Core Field (14 operations)
fs.writeFileSync('./public/openapi-core.json', JSON.stringify(LUNA_CORE_OPENAPI_SPEC, null, 2));
fs.writeFileSync('/mnt/c/Users/Ben/.gemini/antigravity/brain/d17495c6-118d-4194-a670-649f09d34237/scratch/openapi-core.json', JSON.stringify(LUNA_CORE_OPENAPI_SPEC, null, 2));

// Dev & Observability (13 operations)
fs.writeFileSync('./public/openapi-dev.json', JSON.stringify(LUNA_DEV_OPENAPI_SPEC, null, 2));
fs.writeFileSync('/mnt/c/Users/Ben/.gemini/antigravity/brain/d17495c6-118d-4194-a670-649f09d34237/scratch/openapi-dev.json', JSON.stringify(LUNA_DEV_OPENAPI_SPEC, null, 2));

console.log('✓ Unified paths:', Object.keys(LUNA_OPENAPI_SPEC.paths).length);
console.log('✓ Core Field paths:', Object.keys(LUNA_CORE_OPENAPI_SPEC.paths).length);
console.log('✓ Dev Bridge & Observability paths:', Object.keys(LUNA_DEV_OPENAPI_SPEC.paths).length);
