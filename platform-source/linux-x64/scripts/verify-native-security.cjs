// Run on disposable native CI hosts, against the production artifact, never QA.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const exe=path.resolve(process.argv[2]||'');assert.ok(exe.startsWith(path.resolve('dist')+path.sep)&&fs.existsSync(exe));
const root=path.resolve('out/qa-temp/native-production-'+Date.now());fs.mkdirSync(root,{recursive:true});
const connect=port=>new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',()=>resolve(false));s.setTimeout(100,()=>{s.destroy();resolve(false)})});
(async()=>{
 const wire=await require('@electron/fuses').getCurrentFuseWire(process.platform==='darwin'?path.resolve(exe,'../../..'):exe);
 const resources=process.platform==='darwin'?path.resolve(exe,'../../Resources'):path.join(path.dirname(exe),'resources');
 const sqliteRoot=path.join(resources,'app.asar.unpacked/node_modules/better-sqlite3');
 const binding=fs.readFileSync(path.join(sqliteRoot,'build/Release/better_sqlite3.node'));
 assert.deepEqual(binding,fs.readFileSync('node_modules/better-sqlite3/build/Release/better_sqlite3.node'),'Package must contain the freshly compiled binding');
 assert.equal(fs.existsSync(path.join(sqliteRoot,'prebuilds')),false,'No vendor prebuilds in native packages');
 assert.equal(fs.existsSync(path.join(sqliteRoot,'prebuilds-unused')),false,'No quarantined prebuilds in native packages');
 if(process.platform==='darwin')assert.equal(binding.readUInt32LE(4),process.arch==='arm64'?0x0100000c:0x01000007,'Mach-O SQLite architecture must match this runner');
 else {assert.equal(binding.subarray(0,4).toString('hex'),'7f454c46');assert.equal(binding.readUInt16LE(18),62,'ELF SQLite must be x64');}
 for(const index of [0,2,3])assert.equal(wire[index],48);
 assert.equal(wire[5],49);assert.equal(wire[4],process.platform==='darwin'?49:48);
 const rows=[];
 for(const [name,args,extra,blocked] of [
  ['normal',[],{},false],['single-debug',['-remote-debugging-port=19477'],{},true],
  ['double-debug',['--remote-debugging-port=19477'],{},true],['sandbox',['-no-sandbox'],{},true],
  ['single-process',['--single-process'],{},true],['inspect',['--inspect=127.0.0.1:19477'],{},false],
  ['run-as-node',[],{ELECTRON_RUN_AS_NODE:'1'},false]]){
  const folder=path.join(root,name);fs.mkdirSync(folder);const env={...process.env,FOCUSRECALL_DATA_DIR:folder,LEARNALYT_DATA_DIR:folder,TRIFOCUS_DATA_DIR:folder};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;Object.assign(env,extra);
  assert.equal(await connect(19477),false);
  const child=cp.spawn(exe,args,{env,stdio:['ignore','pipe','pipe']});let log='',opened=false;child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  try{
   const start=Date.now();while(Date.now()-start<5000){opened||=await connect(19477);if(child.exitCode!==null)break;await pause(50)}
   assert.equal(opened,false,name+' exposed debugging');const database=fs.existsSync(path.join(folder,'learnalyt.db'));
   if(blocked||name==='inspect'&&child.exitCode===1){assert.equal(child.exitCode,1,name+' must refuse');assert.equal(database,false)}else{assert.equal(child.exitCode,null,name+': '+log);assert.ok(database,name+' did not open fictional database: '+log)}
   rows.push({name,passed:true,database});
  }finally{if(child.exitCode===null){child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),pause(2000)]);if(child.exitCode===null)child.kill('SIGKILL')}}
 }
 console.log(JSON.stringify({nativeProductionSecurity:true,platform:process.platform,arch:process.arch,fuses:wire,rows}));
})().catch(e=>{console.error(e);process.exitCode=1});
