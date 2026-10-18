import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const project=path.dirname(fileURLToPath(import.meta.url));
const sources=['audio-geometry','audio-fixtures','fixtures','mock-services','state','visuals','components','views','voice-engine','app'];
const parts=[];
for(const name of sources){
  const raw=await readFile(path.join(project,'src',`${name}.ts`),'utf8');
  const js=stripTypeScriptTypes(raw,{mode:'strip'}).replace(/^import[^\n]*\n/gm,'').replace(/^export\s+(?=(?:const|let|function|class)\b)/gm,'');
  parts.push(`// ${name}.ts\n${js}`);
}
const assets={};
for(const name of ['water','question'])assets[name]=`data:audio/mpeg;base64,${(await readFile(path.join(project,'assets',`${name}.mp3`))).toString('base64')}`;
const css=(await readFile(path.join(project,'src','styles.css'),'utf8'))+'\n'+(await readFile(path.join(project,'src','refinement.css'),'utf8'));
const js=`(()=>{\n'use strict';\nconst LUNA_AUDIO_ASSETS=${JSON.stringify(assets)};\n${parts.join('\n\n')}\n})();`;
const html=`<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="description" content="Luna — a living personal field. An independent frontend design exploration with synthetic data and local-only interactions.">
<meta name="theme-color" content="#0b1019">
<title>Luna · A living personal field</title>
<style>${css}</style>
</head><body>
<div id="app"></div>
<dialog id="modal"></dialog>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<noscript><p style="padding:30px">Luna's interactive prototype needs JavaScript enabled. No connection to the real Luna backend is made.</p></noscript>
<script>${js.replace(/<\/script/gi,'<\\/script')}</script>
</body></html>`;
await mkdir(path.join(project,'dist'),{recursive:true});
await writeFile(path.join(project,'dist','index.html'),html);
await writeFile(path.join(project,'dist','Luna-Prototype.html'),html);
await writeFile(path.join(project,'dist','app.bundle.js'),js);
// A dependency-free browser review surface. Its iframe has a real viewport,
// so the mobile and desktop buttons exercise the same responsive source.
const review=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Luna · Design review</title><style>
*{box-sizing:border-box}body{margin:0;background:#070b11;color:#dfe5e8;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}header{display:flex;gap:20px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:16px 24px;border-bottom:1px solid #2a3442;min-height:76px}header strong{letter-spacing:4px;font-weight:500;color:#ddc697;font-size:17px}header span{color:#99a7b6;font-size:11px}nav{display:flex;gap:7px;align-items:center}button,a.button{display:inline-flex;align-items:center;border:1px solid #354151;background:#121c29;color:#c5cdd6;padding:9px 14px;min-height:39px;border-radius:6px;cursor:pointer;text-decoration:none;font:inherit;font-size:12px}button[aria-pressed=true]{color:#101720;background:#dbc18c;border-color:#dbc18c}button:focus-visible{outline:2px solid #dbc18c;outline-offset:3px}.note{margin:11px 20px;color:#a0adbc;text-align:center;font-size:11px;line-height:1.7}.stage{padding:8px 14px 18px;display:flex;justify-content:center;overflow:auto}iframe{width:100%;height:calc(100dvh - 142px);min-height:550px;border:1px solid #293342;border-radius:12px;background:#0b1019;max-width:1500px}iframe.mobile{width:404px;max-width:100%;height:844px;min-height:640px;flex-shrink:0;border:7px solid #29313c;border-radius:29px}.view-label{font-variant-numeric:tabular-nums}.external{font-size:11px!important}@media(max-width:600px){header{padding:15px;gap:12px}header span{display:none}nav{width:100%;justify-content:center}button{padding:9px 12px}.note{font-size:10px}.stage{padding:0 8px 18px}iframe{height:calc(100dvh - 180px);min-height:500px}iframe.mobile{height:780px}.view-label{display:none}}
</style></head><body><header><div><strong>LUNA</strong> <span> / A living personal field · independent design exploration</span></div><nav aria-label="Review viewport"><button id="desktop" aria-pressed="true">Desktop</button><button id="mobile" aria-pressed="false">Mobile · 390px</button><button id="full" class="external">Open full prototype ↗</button></nav></header><p class="note">Synthetic content · changes stay in the current session · no production connection or deployment. <span class="view-label" id="size-label"></span></p><div class="stage"><iframe id="preview" title="Interactive Luna frontend prototype" allow="microphone"></iframe></div><script>
const source=${JSON.stringify(html).replace(/</g,'\\u003c')};
const frame=document.getElementById('preview');frame.srcdoc=source;
function setView(mobile){frame.classList.toggle('mobile',mobile);document.getElementById('mobile').setAttribute('aria-pressed',String(mobile));document.getElementById('desktop').setAttribute('aria-pressed',String(!mobile));document.getElementById('size-label').textContent=mobile?'Mobile viewport':'Desktop uses available width';}
document.getElementById('mobile').onclick=()=>setView(true);document.getElementById('desktop').onclick=()=>setView(false);
document.getElementById('full').onclick=()=>{const file=new Blob([source],{type:'text/html'});const url=URL.createObjectURL(file);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);};
</script></body></html>`;
await writeFile(path.join(project,'dist','Luna-Review.html'),review);
console.log(`Built standalone prototype and desktop/mobile review (${Math.round(Buffer.byteLength(html)/1024)} KiB each).`);
