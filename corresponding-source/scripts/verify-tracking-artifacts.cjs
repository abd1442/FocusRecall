const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const asar=await import('@electron/asar'),base=path.resolve('dist/privacy-tracking-20261017'),archive=path.join(base,'win-unpacked/resources/app.asar'),installer=path.join(base,'FocusRecall-0.1.0-beta.27-setup.exe');
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 const files=['out/main','out/preload','out/renderer'].flatMap(walk).map(f=>{const name=f.replaceAll('\\','/'),hash=sha(fs.readFileSync(f));assert.equal(sha(asar.extractFile(archive,path.normalize(name))),hash,name);return {file:name,sha256:hash}});
 const protectedFiles=[
  ['dist/stage4-beta27/win-unpacked/resources/app.asar','270d289789116a39cc041c1e4c4857af6dfe8ae90a61b66f06e719dec8360e6a'],
  ['dist/stage4-beta27/FocusRecall-0.1.0-beta.27-setup.exe','d5eecb97febf9fa6bd4ff1d544c1941f42932d3920177fbb4861dce151d4e191']
 ].map(([file,expected])=>{const actual=sha(fs.readFileSync(file));assert.equal(actual,expected,file);return {file,sha256:actual,unchanged:true}});
 const timing=JSON.parse(fs.readFileSync('docs/verification/timing-integrity-20261017/artifacts.json','utf8'));
 for(const [file,expected] of [[timing.archive,timing.archiveSHA256],[timing.installer,timing.installerSHA256]]){assert.equal(sha(fs.readFileSync(file)),expected,file);protectedFiles.push({file,sha256:expected,unchanged:true})}
 const statistical=JSON.parse(fs.readFileSync('docs/verification/statistical-validity-20261017/artifacts.json','utf8'));
 for(const [file,expected] of [[statistical.archive,statistical.archiveSHA256],[statistical.installer,statistical.installerSHA256]]){assert.equal(sha(fs.readFileSync(file)),expected,file);protectedFiles.push({file,sha256:expected,unchanged:true})}
 const recommendations=JSON.parse(fs.readFileSync('docs/verification/recommendation-policy-20261017/artifacts.json','utf8'));
 for(const [file,expected] of [[recommendations.archive,recommendations.archiveSHA256],[recommendations.installer,recommendations.installerSHA256]]){assert.equal(sha(fs.readFileSync(file)),expected,file);protectedFiles.push({file,sha256:expected,unchanged:true})}
 const native='resources/native/win32-x64/foreground.node',packagedNative=path.join(base,'win-unpacked/resources/app.asar.unpacked',native);assert.equal(sha(fs.readFileSync(native)),sha(fs.readFileSync(packagedNative)));
 assert.equal(sha(fs.readFileSync('resources/legal/PRIVACY.txt')),sha(fs.readFileSync(path.join(base,'win-unpacked/resources/legal/PRIVACY.txt'))));
 const receipt={archive,archiveSHA256:sha(fs.readFileSync(archive)),installer,installerSHA256:sha(fs.readFileSync(installer)),installerInstalled:false,allBuiltRuntimeFilesMatch:true,nativeSHA256:sha(fs.readFileSync(packagedNative)),nativeMatches:true,privacyDisclosureMatches:true,files,protectedFiles};
 fs.writeFileSync('docs/verification/privacy-tracking-20261017/artifacts.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({...receipt,files:files.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
