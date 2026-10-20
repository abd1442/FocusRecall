// Only on the target host. No downloads/copies of precompiled native bindings.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const runtime=process.argv[2],arch=process.argv[3]||process.arch;
if(!['linux','darwin'].includes(process.platform)||arch!==process.arch||!['node','electron'].includes(runtime))throw Error('Use the matching native Linux/macOS runner.');
const root=process.cwd(),moduleRoot=path.dirname(require.resolve('better-sqlite3/package.json'));
if(!fs.realpathSync(moduleRoot).startsWith(fs.realpathSync(path.join(root,'node_modules'))+path.sep))throw Error('SQLite must belong to this build environment.');
const version=runtime==='electron'?require('../package.json').devDependencies.electron:process.versions.node;
cp.execFileSync(process.execPath,[require.resolve('node-gyp/bin/node-gyp.js'),'rebuild','--release','--force_build=1','--arch='+arch,'--target='+version,...(runtime==='electron'?['--dist-url=https://www.electronjs.org/headers']:[])],{cwd:moduleRoot,stdio:'inherit'});
const binding=path.join(moduleRoot,'build/Release/better_sqlite3.node'),bytes=fs.readFileSync(binding),magic=bytes.subarray(0,4).toString('hex');
if(process.platform==='linux'&&magic!=='7f454c46'||process.platform==='darwin'&&!['cffaedfe','feedfacf','cafebabe','bebafeca'].includes(magic))throw Error('Wrong native binary format.');
// The default SQLite loader prefers bundled prebuilds. Quarantine only this
// runner's dependency directory so tests must use the just-compiled binding.
const prebuilds=path.join(moduleRoot,'prebuilds');
if(fs.existsSync(prebuilds))fs.renameSync(prebuilds,path.join(moduleRoot,'prebuilds-unused'));
console.log(JSON.stringify({compiledSQLite:true,runtime,version,platform:process.platform,arch,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
