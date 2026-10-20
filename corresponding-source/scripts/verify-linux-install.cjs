const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
if(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true')throw Error('Disposable native Linux CI only');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),run=(exe,args)=>cp.execFileSync(exe,args,{stdio:'inherit'});
const root=path.resolve('out/qa-temp/installed-production-'+Date.now());fs.mkdirSync(root,{recursive:true});
const Database=require('better-sqlite3'),output='docs/verification/native-ci/installation.json',result={actualDebInstallation:false,uninstallPreservesData:false,reinstall:false,appImage:null};
function data(dir){const db=new Database(path.join(dir,'learnalyt.db'),{readonly:true});try{return{integrity:db.pragma('integrity_check',{simple:true}),items:db.prepare('SELECT * FROM items ORDER BY id').all(),blocks:db.prepare('SELECT * FROM blocks ORDER BY id').all(),mode:db.prepare("SELECT value FROM settings WHERE key='studyExperience'").get()}}finally{db.close()}}
async function boot(exe,dir,extra={}){
 fs.mkdirSync(dir,{recursive:true});const env={...process.env,...extra,FOCUSRECALL_DATA_DIR:dir,LEARNALYT_DATA_DIR:dir,TRIFOCUS_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const child=cp.spawn(exe,[],{env,detached:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>{log=(log+b).slice(-12000)});child.stderr.on('data',b=>{log=(log+b).slice(-12000)});
 try{for(let i=0;i<100;i++){await pause(80);if(child.exitCode!==null)break}return{alive:child.exitCode===null,database:fs.existsSync(path.join(dir,'learnalyt.db')),exitCode:child.exitCode,log}}
 finally{try{process.kill(-child.pid,'SIGTERM')}catch{}await pause(300);try{process.kill(-child.pid,'SIGKILL')}catch{}await pause(200)}
}
(async()=>{try{
 const passed=JSON.parse(fs.readFileSync('docs/verification/native-ci/x11/results.json','utf8'));assert.equal(passed.success,true);const source=passed.fixture;assert.match(source,/^native-ui-[0-9]+$/);assert.equal(fs.readFileSync(path.resolve('out/qa-temp',source,'QA-FICTIONAL.txt'),'utf8').trim(),'FocusRecall fictional profile only');
 const original=new Database(path.resolve('out/qa-temp',source,'learnalyt.db'),{readonly:true});try{await original.backup(path.join(root,'learnalyt.db'))}finally{original.close()}
 const before=data(root);assert.ok(before.items.length>0);const deb=fs.readdirSync('dist/linux-engineering').find(n=>n.endsWith('.deb'));assert.ok(deb);
 run('sudo',['apt-get','install','-y','--no-install-recommends',path.resolve('dist/linux-engineering',deb)]);
 const executable='/opt/FocusRecall/focusrecall';assert.ok(fs.existsSync(executable));const first=await boot(executable,root);assert.ok(first.alive&&first.database,JSON.stringify(first));assert.deepEqual(data(root),before);result.actualDebInstallation=true;
 const file=path.join(root,'learnalyt.db'),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),saved=hash();run('sudo',['dpkg','--remove','focusrecall']);assert.equal(fs.existsSync(executable),false);assert.equal(hash(),saved);result.uninstallPreservesData=true;
 run('sudo',['apt-get','install','-y','--no-install-recommends',path.resolve('dist/linux-engineering',deb)]);const again=await boot(executable,root);assert.ok(again.alive&&again.database,JSON.stringify(again));assert.deepEqual(data(root),before);result.reinstall=true;
 const image=fs.readdirSync('dist/linux-engineering').find(n=>n.endsWith('.AppImage'));assert.ok(image);
 const fuse=fs.existsSync('/dev/fuse');result.appImage={fuseMountTest:fuse,...await boot(path.resolve('dist/linux-engineering',image),path.join(root,'appimage-fixture'),fuse?{}:{APPIMAGE_EXTRACT_AND_RUN:'1'})};
 result.appImage.warning=result.appImage.alive?'Hardware/compositor installation still needs a human test.':'AppImage startup blocked in this environment. No no-sandbox, host policy change or elevated launcher was used. Prefer the verified DEB.';
 result.success=true;
}catch(e){result.error=e.stack;process.exitCode=1;console.error(e)}finally{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result))}})();
