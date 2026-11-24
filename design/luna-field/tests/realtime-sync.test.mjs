import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldRealtime} from '../src/realtime-sync.ts';
test('realtime scopes tables, coalesces updates, rotates auth and cancels old-account events',async()=>{
 const clients=[];let session={userId:'A',token:'first'},changes=0;
 class Client{
  constructor(url,options){this.options=options;this.events=[];this.tokens=[];clients.push(this);}
  channel(){return {on:(_event,filter,cb)=>{this.events.push({filter,cb});},subscribe:()=>{}};}
  disconnect(){this.closed=true;}async removeAllChannels(){}
  async setAuth(){this.tokens.push(await this.options.accessToken());}
 }
 const rt=createFieldRealtime({Client,url:'https://test.invalid',apiKey:'public',session:()=>session,changed:()=>changes++});
 rt.start();assert.equal(clients.length,1);assert.equal(clients[0].events.length,3);
 assert.ok(clients[0].events.every(e=>e.filter.filter==='user_id=eq.A'));
 clients[0].events[0].cb();clients[0].events[1].cb();
 await new Promise(r=>setTimeout(r,250));assert.equal(changes,1);
 session.token='second';rt.start();await Promise.resolve();assert.deepEqual(clients[0].tokens,['second']);
 clients[0].events[0].cb();session={userId:'B',token:'other'};rt.start();
 assert.equal(clients[0].closed,true);assert.equal(await clients[0].options.accessToken(),null);
 clients[0].events[0].cb();await new Promise(r=>setTimeout(r,250));assert.equal(changes,1);
 assert.ok(clients[1].events.every(e=>e.filter.filter==='user_id=eq.B'));
 session={userId:null,token:null};rt.start();assert.equal(clients[1].closed,true);
});
