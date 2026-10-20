const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
if(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true')throw Error('Private disposable Linux CI bus only');
const pause=ms=>new Promise(r=>setTimeout(r,ms));let service,watch;
(async()=>{try{
 const target=path.resolve('out/qa-temp/native-lock-transport.cjs');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,require('typescript').transpileModule(fs.readFileSync('src/main/linuxLock.ts','utf8'),{compilerOptions:{module:require('typescript').ModuleKind.CommonJS,target:require('typescript').ScriptTarget.ES2022}}).outputText);
 const {LinuxLockWatch,lockProviders}=require(target),provider=lockProviders('GNOME')[0];
 const start=()=>cp.spawn('/usr/bin/python3',['scripts/fixtures/linux-lock-service.py'],{stdio:'inherit'});
 const wait=async predicate=>{for(let i=0;i<80;i++){if(await predicate())return;await pause(50)}throw Error('Timed out waiting for fixture bus state')};
 service=start();await wait(()=>cp.spawnSync('/usr/bin/gdbus',['call','--session','--dest',provider.name,'--object-path',provider.path,'--method',provider.iface+'.GetActive'],{stdio:'ignore'}).status===0);const changes=[];watch=new LinuxLockWatch(s=>changes.push(s),undefined,[provider]);await watch.start();await wait(()=>watch.state==='active');
 const set=active=>cp.execFileSync('/usr/bin/gdbus',['call','--session','--dest',provider.name,'--object-path',provider.path,'--method',provider.iface+'.FixtureSet',String(active)],{stdio:'pipe'});
 changes.length=0;set(true);set(false);await wait(()=>changes.includes('locked')&&watch.state==='active');
 service.kill();await wait(()=>watch.state==='unknown');service=start();await wait(()=>watch.state==='active');watch.dispose();set(true);await pause(100);assert.equal(watch.state,'unknown');
 console.log(JSON.stringify({passed:true,test:'real session D-Bus transport against fictional lock service',shortLockPulse:true,ownerLoss:true,serviceRestart:true,dispose:true,physicalDesktopLock:false}));
}finally{watch?.dispose();service?.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
