// Inspect the actual local package; never install or publish it.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const output=path.resolve(process.env.FOCUSRECALL_SECURITY_QA_OUTPUT||'docs/verification/release-security-20261018');assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));fs.mkdirSync(output,{recursive:true});
const exe=path.resolve(process.argv[2]);assert.ok(exe.startsWith(path.resolve('dist')+path.sep)&&fs.existsSync(exe));
const folder=path.dirname(exe),archive=path.join(folder,'resources/app.asar'),legal=path.join(folder,'resources/legal');
assert.ok(!fs.existsSync(path.join(folder,'QA_BUILD.txt')));
const manifest=JSON.parse(asar.extractFile(archive,'package.json').toString());assert.equal(manifest.license,'GPL-3.0-only');
assert.equal(JSON.parse(asar.extractFile(archive,path.join('out','main','build-profile.json')).toString()).profile,'production');
const normalize=s=>s.replace(/\r\n/g,'\n');const license=normalize(fs.readFileSync('LICENSE','utf8'));
assert.equal(normalize(fs.readFileSync(path.join(legal,'LICENSE.txt'),'utf8')),license);
for(const name of ['EULA.txt','PRIVACY.txt','THIRD-PARTY-NOTICES.txt'])assert.equal(normalize(fs.readFileSync(path.join(legal,name),'utf8')),normalize(fs.readFileSync('resources/legal/'+name,'utf8')));
assert.ok(normalize(fs.readFileSync(path.join(legal,'EULA.txt'),'utf8')).includes(license));
for(const name of ['LICENSE.electron.txt','LICENSES.chromium.html'])assert.ok(fs.statSync(path.join(folder,name)).size>0);
const entries=asar.listPackage(archive);assert.ok(!entries.some(name=>/^[/\\](?:docs|src|out[/\\]qa-temp)(?:[/\\]|$)/.test(name)||/\.(?:db|sqlite3?|pem|pfx|key|map|log)$/.test(name)));
require('./check-packaged-runtime.cjs')({appOutDir:folder});
const files=[exe,archive,path.join(folder,'resources/app.asar.unpacked/resources/native/win32-x64/foreground.node'),...fs.readdirSync(legal).map(n=>path.join(legal,n))];
const workstation=path.resolve('.'),patterns=[workstation,workstation.replaceAll('\\','/'),process.env.USERPROFILE].filter(Boolean);
for(const file of files){assert.ok(fs.existsSync(file),file);const data=fs.readFileSync(file);for(const value of patterns)for(const encoding of ['utf8','utf16le'])assert.equal(data.indexOf(Buffer.from(value,encoding)),-1,'Workstation path in '+path.basename(file))}
const receipt={productionProfile:true,license:manifest.license,legalFilesMatch:true,electronChromiumNotices:true,noSourceProfilesOrMapsInAsar:true,noWorkstationPathsInInspectedFiles:true,files:files.map(file=>({file:path.relative(process.cwd(),file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
if(process.argv[3]){
 const qa=path.resolve(process.argv[3]);assert.ok(qa.startsWith(path.resolve('dist')+path.sep)&&fs.existsSync(path.join(path.dirname(qa),'QA_BUILD.txt')));
 const qaArchive=path.join(path.dirname(qa),'resources/app.asar');
 const rendererFiles=file=>asar.listPackage(file).map(n=>n.replace(/^[/\\]/,'')).filter(n=>/^out[/\\](?:renderer|preload)[/\\]/.test(n)&&asar.statFile(file,n).size!==undefined).sort();
 const names=rendererFiles(archive);assert.deepEqual(names,rendererFiles(qaArchive));for(const name of names)assert.deepEqual(asar.extractFile(archive,name),asar.extractFile(qaArchive,name),name);
 receipt.qaRendererPreloadParity={identical:true,files:names.length};
}
fs.writeFileSync(path.join(output,'packaged-hygiene.json'),JSON.stringify(receipt,null,2));console.log('PASS production profile, GPL notices, dependency notices and bounded artifact hygiene scan');
