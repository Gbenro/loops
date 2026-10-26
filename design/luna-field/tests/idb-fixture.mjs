// Deterministic durable-store double for service tests; browser tests exercise real IDB.
export function installIDB() {
  const records = new Map();
  globalThis.indexedDB = {open() {
    const request = {};
    queueMicrotask(() => {
      const db = {close(){},objectStoreNames:{contains:()=>true},transaction() {
        const tx = {objectStore:()=>({
          put(value,key){records.set(key || value.id,structuredClone(value));setTimeout(()=>tx.oncomplete?.(),0);},
          delete(key){records.delete(key);setTimeout(()=>tx.oncomplete?.(),0);},
          get(key){const r={};queueMicrotask(()=>{r.result=records.get(key);r.onsuccess?.();});return r;},
          openCursor(){const r={}, items=[...records.values()];let i=0;const next=()=>queueMicrotask(()=>r.onsuccess?.({target:{result:i<items.length?{value:items[i++],continue:next}:null}}));next();return r;}
        })};return tx;
      }};
      request.result=db;request.onsuccess?.({target:{result:db}});
    });return request;
  }};
  return records;
}
installIDB();
