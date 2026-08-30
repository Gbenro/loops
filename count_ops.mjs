import { LUNA_OPENAPI_SPEC } from './mcp-server/dist/openapi.js';

let ops = [];
for (const [pathUrl, item] of Object.entries(LUNA_OPENAPI_SPEC.paths)) {
  for (const [method, op] of Object.entries(item)) {
    ops.push({ path: pathUrl, method: method.toUpperCase(), opId: op.operationId });
  }
}

console.log('Total Operations Count:', ops.length);
ops.forEach((o, idx) => {
  console.log(`${idx + 1}. [${o.method}] ${o.path} -> ${o.opId}`);
});
