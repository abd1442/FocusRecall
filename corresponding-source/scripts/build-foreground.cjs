// Build-time only: MSVC + Windows SDK and cached Node headers. No downloads.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
if(process.platform!=='win32') {console.log('Windows foreground binding skipped on this platform.');process.exit(0)}
if(process.arch!=='x64')throw Error('The Windows foreground binding currently targets x64.');
const vswhere=path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft Visual Studio/Installer/vswhere.exe');
const vs=cp.execFileSync(vswhere,['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath'],{encoding:'utf8'}).trim();
if(!vs)throw Error('Install the MSVC x64 build tools to build the optional foreground binding.');
const newest=d=>fs.readdirSync(d).filter(n=>/^\d+\./.test(n)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0];
const vc=path.join(vs,'VC/Tools/MSVC'),v=path.join(vc,newest(vc));
const kits=path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Windows Kits/10'),sdk=newest(path.join(kits,'Include'));
const cache=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'node-gyp/Cache');
const headers=process.env.FOCUSRECALL_NODE_HEADERS||path.join(cache,newest(cache));
const out=path.resolve('resources/native/win32-x64'),scratch=path.resolve('out/native-foreground');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const env={...process.env,INCLUDE:[path.join(v,'include'),...['ucrt','shared','um'].map(n=>path.join(kits,'Include',sdk,n))].join(';'),LIB:[path.join(v,'lib/x64'),...['ucrt','um'].map(n=>path.join(kits,'Lib',sdk,n,'x64'))].join(';')};
const args=['/nologo','/LD','/MT','/O2','/W4','/WX','/utf-8','/DNAPI_VERSION=8','/I'+path.join(headers,'include/node'),path.resolve('native/foreground/foreground.cc'),'/Fo'+path.join(scratch,'foreground.obj'),'/link','/INCREMENTAL:NO','/Brepro','/OUT:'+path.join(out,'foreground.node'),'/IMPLIB:'+path.join(scratch,'foreground.lib'),path.join(headers,'x64/node.lib'),'user32.lib','kernel32.lib','delayimp.lib','/DELAYLOAD:node.exe'];
cp.execFileSync(path.join(v,'bin/Hostx64/x64/cl.exe'),args,{env,stdio:'inherit',windowsHide:true});
console.log('Built resources/native/win32-x64/foreground.node (Node-API 8, static CRT).');

if(process.argv.includes('--fixture')){
 cp.execFileSync(path.join(v,'bin/Hostx64/x64/cl.exe'),['/nologo','/MT','/O2','/W4','/WX','/utf-8',path.resolve('scripts/fixtures/foreground-window.cc'),'/Fo'+path.join(scratch,'fixture.obj'),'/link','/INCREMENTAL:NO','/SUBSYSTEM:WINDOWS','/OUT:'+path.join(scratch,'FocusRecallTrackingFixture.exe'),'user32.lib','kernel32.lib'],{env,stdio:'inherit',windowsHide:true});
}
