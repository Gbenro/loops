import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../../../public/beta/index.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const context=await browser.newContext();const AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token';
let release,started;const waiting=new Promise(r=>started=r);const errors=[];
await context.route('**/*',async route=>{
 const url=route.request().url();
 if(url.startsWith('https://luna-review.test/'))return route.fulfill({body:html,contentType:'text/html'});
 if(url.includes('/auth/v1/token?grant_type=refresh_token')){started();await new Promise(r=>release=r);return route.fulfill({json:{access_token:'late-A-token',refresh_token:'late-A-refresh',user:{id:'A'}}});}
 if(url.includes('.supabase.co/'))return route.fulfill({json:[]});
 return route.abort();
});
const a=await context.newPage(),b=await context.newPage();a.on('pageerror',e=>errors.push(e.message));b.on('pageerror',e=>errors.push(e.message));
try{
 await a.goto('https://luna-review.test/');await b.goto('https://luna-review.test/');
 await b.evaluate(key=>localStorage.setItem(key,JSON.stringify({access_token:'old-A',refresh_token:'refresh-A',expires_at:1,user:{id:'A'}})),AUTH);
 await a.reload();await waiting;
 await b.evaluate(key=>localStorage.setItem(key,JSON.stringify({access_token:'current-B',user:{id:'B'}})),AUTH);
 await a.waitForTimeout(100);release();await a.waitForTimeout(200);
 assert.equal(await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).user.id,AUTH),'B');
 assert.equal(await b.evaluate(key=>JSON.parse(localStorage.getItem(key)).access_token,AUTH),'current-B');
 await b.evaluate(key=>localStorage.removeItem(key),AUTH);await a.waitForTimeout(100);await a.reload();assert.equal(await a.evaluate(key=>localStorage.getItem(key),AUTH),null);
 assert.deepEqual(errors,[]);
 const evidence={crossTabRefreshCannotRestoreA:true,signedOutReloadStaysSignedOut:true,realWebLocks:await a.evaluate(()=>!!navigator.locks),pageErrors:errors};
 fs.writeFileSync(new URL('../dist/auth-browser-evidence.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}
