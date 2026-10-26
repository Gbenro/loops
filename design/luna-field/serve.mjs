import http from 'node:http';
import fs from 'node:fs';
const html=()=>fs.readFileSync(new URL('../../public/beta/index.html',import.meta.url));
const port=Number(process.env.LUNA_BETA_PORT||5183);
http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!['/','/beta/','/beta/index.html'].includes(path)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html());
}).listen(port,'127.0.0.1',()=>console.log(`Luna Beta release candidate: http://127.0.0.1:${port}/#/listen`));
