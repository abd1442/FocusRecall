// Extract a locally built NSIS installer; never execute Setup or touch installed data.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const installer=path.resolve(process.argv[2]||''),production=path.resolve(process.argv[3]||'');
for(const p of [installer,production])assert.ok(p.startsWith(path.resolve('dist')+path.sep)&&fs.existsSync(p),'Use local dist artifacts');
const seven=process.env.FOCUSRECALL_7ZIP||path.join(process.env.ProgramFiles||'C:/Program Files','7-Zip/7z.exe');assert.ok(fs.existsSync(seven),'Set FOCUSRECALL_7ZIP to an existing 7-Zip executable');
const root=path.resolve('out/qa-temp/installer-payload-'+Date.now()),output=path.resolve(process.env.FOCUSRECALL_PAYLOAD_OUTPUT||'docs/verification/installer-payload-'+Date.now());assert.ok(output.startsWith(path.resolve('docs/verification')+path.sep));assert.ok(!fs.existsSync(root));fs.mkdirSync(root,{recursive:true});fs.mkdirSync(output,{recursive:true});
const walk=(dir,prefix='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const extract=(file,dir)=>cp.execFileSync(seven,['x',file,'-o'+dir,'-y'],{stdio:'pipe',windowsHide:true,maxBuffer:8*1024*1024});
extract(installer,path.join(root,'nsis'));const archives=walk(path.join(root,'nsis')).filter(p=>/(^|\/)app-64\.7z$/.test(p));assert.equal(archives.length,1,'Expected one x64 application payload');
const payload=path.join(root,'application');extract(path.join(root,'nsis',archives[0]),payload);
const expected=walk(production).sort(),actual=walk(payload).sort();assert.deepEqual(actual,expected,'Payload file set must exactly match production');
const files=expected.map(file=>{const sha256=hash(path.join(production,file));assert.equal(hash(path.join(payload,file)),sha256,file);return{file,sha256,bytes:fs.statSync(path.join(payload,file)).size}});
fs.writeFileSync(path.join(output,'payload.json'),JSON.stringify({success:true,installerExecuted:false,installer:path.relative(process.cwd(),installer).split(path.sep).join('/'),installerSha256:hash(installer),production:path.relative(process.cwd(),production).split(path.sep).join('/'),files},null,2));console.log('PASS '+files.length+' installer payload files match production; Setup was not executed');
