const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// Signing can alter __LINKEDIT sizes and signature load commands. All
// file-backed Mach-O sections (code, constants, data, unwind info) must match.
function machoSections(bytes){
 assert.ok(bytes.length>=32);assert.equal(bytes.readUInt32LE(0),0xfeedfacf);
 const count=bytes.readUInt32LE(16),end=32+bytes.readUInt32LE(20);assert.ok(end<=bytes.length);const sections=[];let offset=32;
 for(let i=0;i<count;i++){
  assert.ok(offset+8<=end);const command=bytes.readUInt32LE(offset),size=bytes.readUInt32LE(offset+4);assert.ok(size>=8&&offset+size<=end);
  if(command===0x19){
   assert.ok(size>=72);const n=bytes.readUInt32LE(offset+64);assert.ok(72+n*80<=size);
   for(let j=0;j<n;j++){
    const s=offset+72+j*80,name=bytes.subarray(s,s+16).toString().replace(/\0.*$/s,''),segment=bytes.subarray(s+16,s+32).toString().replace(/\0.*$/s,''),length=Number(bytes.readBigUInt64LE(s+40)),start=bytes.readUInt32LE(s+48),type=bytes.readUInt32LE(s+64)&255;
    if([1,12,18].includes(type))continue;assert.ok(Number.isSafeInteger(length)&&start+length<=bytes.length);
    sections.push({segment,name,length,sha256:digest(bytes.subarray(start,start+length))});
   }
  }offset+=size;
 }assert.equal(offset,end);assert.ok(sections.length>0);return sections;
}
function beforeSign(context){
 require('./check-packaged-runtime.cjs')(context);
 const resources=context.electronPlatformName==='darwin'?path.join(context.appOutDir,context.packager.appInfo.productFilename+'.app/Contents/Resources'):path.join(context.appOutDir,'resources');
 const packaged=fs.readFileSync(path.join(resources,'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node')),source=fs.readFileSync('node_modules/better-sqlite3/build/Release/better_sqlite3.node');
 assert.equal(digest(packaged),digest(source),'Before signing, packaged SQLite must exactly match the compiled binding');
 const proof={compiledSHA256:digest(source),platform:process.platform,arch:process.arch};
 fs.writeFileSync(path.join(context.appOutDir,'native-binding-proof.json'),JSON.stringify(proof));console.log('Native binding provenance: '+JSON.stringify(proof));
}
module.exports={digest,machoSections,beforeSign};
