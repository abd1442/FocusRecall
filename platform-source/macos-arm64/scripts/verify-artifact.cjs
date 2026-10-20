const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const root=process.cwd(),archive=path.resolve(process.argv[2]||'dist/development/win-unpacked/resources/app.asar');
const files=asar.listPackage(archive).map(f=>f.replaceAll('\\','/').replace(/^\//,''));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const walk=folder=>fs.readdirSync(path.join(root,folder),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(folder+'/'+e.name):[folder+'/'+e.name]);
const built=['out/main','out/preload','out/renderer'].flatMap(walk);
for(const file of built){assert.ok(files.includes(file),'Missing bundle '+file);assert.equal(sha(asar.extractFile(archive,path.join(...file.split('/')))),sha(fs.readFileSync(file)),'Bundle mismatch '+file)}
const forbidden=files.filter(f=>/^(?:docs|src|scripts|\.github|publication-local)\//.test(f)||(/^out\//.test(f)&&!/^out\/(?:main|preload|renderer)(?:\/|$)/.test(f)&&f!=='out')||/\.(?:db|db-wal|db-shm|sqlite|log|pfx|pem)$/i.test(f));assert.deepEqual(forbidden,[]);
assert.deepEqual(files.filter(f=>/^node_modules\/better-sqlite3\/(?:build|deps|src)\//.test(f)),[],'No unused native compiler artifacts');
assert.ok(files.some(f=>f.endsWith('better-sqlite3/prebuilds/win32-x64.node')),'Packaged Windows native SQLite');
const result={date:new Date().toISOString().slice(0,10),archive:path.basename(archive),archiveSha256:sha(fs.readFileSync(archive)),bundleFilesCompared:built.length,matchedCurrentBuild:true,unwantedRuntimeFiles:forbidden,windowsSqlitePresent:true};
const output=path.resolve(process.env.FOCUSRECALL_ARTIFACT_QA_OUTPUT||'publication-local/asar-verification.json');
assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep)||output.startsWith(path.resolve('publication-local')+path.sep));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
