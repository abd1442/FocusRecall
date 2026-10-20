// Local release diagnostics against a deliberately isolated debug-enabled app.
// Never launch the ordinary profile with remote debugging.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = path.resolve('out/qa-temp/publication-20261015');
assert.equal(JSON.parse(fs.readFileSync(path.join(base,'config.json'),'utf8')).demo,true);
(async()=>{
  const targets=await fetch('http://127.0.0.1:9337/json/list').then(r=>r.json());
  const target=targets.find(t=>t.url.endsWith('/out/renderer/index.html'));
  assert.ok(target,'Main packaged renderer');
  const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;
  await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
  const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
  const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
  assert.equal(await evaluate("window.api.invoke('app:demo')"),true);
  const raw=await evaluate("window.api.invoke('stats:raw')");
  const info={demo:true,packaged:target.url.includes('/app.asar/'),blocks:raw.blocks.length,trackingOff:await evaluate("window.api.invoke('settings:getAll').then(s=>s.foregroundTrackingEnabled===false)"),body:await evaluate('document.body.innerText')};
  fs.writeFileSync(path.join(base,'diagnostic.json'),JSON.stringify(info,null,2));
  console.log(JSON.stringify(info,null,2));ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
