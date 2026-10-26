// Local CI only: serve the production-built Beta entry without Vite's dev rewrite.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
const body = await readFile(new URL('../dist/beta/index.html', import.meta.url));
http.createServer((req, res) => {
  if (!['/beta', '/beta/'].includes(req.url?.split('?')[0])) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body);
}).listen(4178, '127.0.0.1');

