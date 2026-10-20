// Download exact published runtime package inputs; never execute their scripts.
// Does not claim npm tarballs are the preferred upstream source for every dependency.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const output=path.resolve(process.argv[2]||'publication-local/rc-dependency-inputs');assert.ok(output.startsWith(path.resolve('publication-local')+path.sep));assert.ok(!fs.existsSync(output),'Choose a fresh directory');fs.mkdirSync(output,{recursive:true});
const lock=require('../package-lock.json'),inventory=require('../resources/legal/inventory.json');
(async()=>{
 const rows=[];
 for(const {name,version} of inventory){
  const key=Object.keys(lock.packages).find(k=>k.endsWith('node_modules/'+name)&&lock.packages[k].version===version);assert.ok(key,name);
  const p=lock.packages[key];assert.ok(/^https:\/\/registry\.npmjs\.org\//.test(p.resolved));assert.ok(p.integrity);
  const response=await fetch(p.resolved,{signal:AbortSignal.timeout(60000)});assert.ok(response.ok,p.resolved);
  const bytes=Buffer.from(await response.arrayBuffer()),algorithm=p.integrity.split('-')[0];assert.equal(algorithm,'sha512');assert.equal(crypto.createHash(algorithm).update(bytes).digest('base64'),p.integrity.slice(algorithm.length+1));
  const file=name.replaceAll('/','-').replace('@','')+'-'+version+'.tgz';fs.writeFileSync(path.join(output,file),bytes);
  rows.push({name,version,file,resolved:p.resolved,integrity:p.integrity,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 fs.writeFileSync(path.join(output,'MANIFEST.json'),JSON.stringify({scope:'Exact npm runtime inputs matching license inventory. Includes upstream notices, not legal certification or complete Electron/Chromium source.',packages:rows},null,2)+'\n');console.log('Verified '+rows.length+' runtime package inputs; no package scripts executed.');
})().catch(e=>{console.error(e);process.exitCode=1});
