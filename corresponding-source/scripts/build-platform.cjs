const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const platform=process.argv[2],arch=process.argv[3]||process.arch;
if(!['linux','darwin'].includes(platform)||process.platform!==platform)throw Error('Build on the target Linux/macOS host, never with Windows node_modules.');
if(!(['x64','arm64'].includes(arch))||(platform==='linux'&&arch!=='x64')||arch!==process.arch)throw Error('Use a native runner for each target architecture.');
if(process.env.FOCUSRECALL_QA_BUILD)throw Error('Production package cannot use QA output.');
const run=(file,args,env=process.env)=>cp.execFileSync(file,args,{stdio:'inherit',env});
const cli=path.resolve('node_modules/electron-builder/out/cli/cli.js');
// Compile SQLite against this host's installed Electron headers. No copying a
// prebuilt Windows binding or skipping native compilation as a fallback.
(async()=>{
// better-sqlite3 13 has its own force_build gate: electron-rebuild's force
// flag alone can successfully run a no-op GYP target when prebuilds exist.
// Compile explicitly, then keep builder from cleaning away this output.
run(process.execPath,[path.resolve('scripts/compile-native-sqlite.cjs'),'electron',arch]);
const binding=path.resolve('node_modules/better-sqlite3/build/Release/better_sqlite3.node');
if(!fs.existsSync(binding))throw Error('Missing freshly compiled SQLite binding.');
const magic=fs.readFileSync(binding).subarray(0,4).toString('hex');
if(platform==='linux'&&magic!=='7f454c46')throw Error('Linux requires an ELF binding.');
if(platform==='darwin'&&!['cffaedfe','feedfacf','cafebabe','bebafeca'].includes(magic))throw Error('macOS requires a Mach-O binding.');
run(process.platform==='win32'?'npm.cmd':'npm',['run','build']);
run(process.execPath,[cli,platform==='linux'?'--linux':'--mac','--'+arch,...(process.argv.includes('--dir')?['--dir']:[]),'--config',platform==='linux'?'electron-builder.linux.cjs':'electron-builder.mac.cjs','--publish','never']);

})().catch(error=>{console.error(error);process.exitCode=1});
