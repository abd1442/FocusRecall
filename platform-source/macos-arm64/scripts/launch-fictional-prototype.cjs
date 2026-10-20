// Local review only. Never falls back to an installed/default profile or downloads tools.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),relative=p=>path.resolve(project,p),within=(file,folder)=>file.startsWith(folder+path.sep);
try{
 const receiptFile=path.resolve(process.argv[2]||'');assert.ok(within(receiptFile,relative('publication-local')),'Use the generated local prototype receipt.');
 const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));assert.equal(receipt.kind,'local-fictional-qa-prototype');
 const exe=relative(receipt.executable);assert.ok(within(exe,relative('dist')));assert.ok(fs.existsSync(path.join(path.dirname(exe),'QA_BUILD.txt')));
 assert.ok(Array.isArray(receipt.files)&&receipt.files.length>=2);
 const supplied=receipt.files.map(r=>relative(r.file));assert.equal(new Set(supplied).size,supplied.length);
 for(const required of [exe,path.join(path.dirname(exe),'resources','app.asar')])assert.ok(supplied.includes(required),'Incomplete prototype receipt.');
 for(const row of receipt.files){const file=relative(row.file);assert.ok(within(file,path.dirname(exe)));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),row.sha256,'Prototype changed; regenerate/verify its receipt before running.')}
 const root=relative('out/qa-temp/quick-prototype-preview-20261019'),marker=path.join(root,'QA-FICTIONAL.txt');
 fs.mkdirSync(relative('out/qa-temp'),{recursive:true});
 if(fs.existsSync(root)){
  assert.ok(!fs.lstatSync(root).isSymbolicLink());assert.ok(within(fs.realpathSync(root),fs.realpathSync(relative('out/qa-temp'))));
  assert.equal(fs.readFileSync(marker,'utf8').trim(),'FocusRecall fictional profile only');
  assert.equal(fs.readFileSync(path.join(root,'QUICK-PROTOTYPE.txt'),'utf8').trim(),'FocusRecall Quick prototype fictional profile only');
 }else{
  fs.mkdirSync(root);fs.writeFileSync(marker,'FocusRecall fictional profile only');fs.writeFileSync(path.join(root,'QUICK-PROTOTYPE.txt'),'FocusRecall Quick prototype fictional profile only');fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({demo:false}));
 }
 const env={...process.env,FOCUSRECALL_DATA_DIR:root,LEARNALYT_DATA_DIR:root,TRIFOCUS_DATA_DIR:root};
 for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_NO_ASAR','ELECTRON_ENABLE_LOGGING','ELECTRON_LOG_FILE'])delete env[key];
 // This is the explicitly requested interactive prototype, not a hidden QA helper.
 const child=cp.spawn(exe,[],{cwd:root,env,windowsHide:false,detached:true,stdio:'ignore'});child.on('error',()=>{console.error('Could not start the local prototype. No installed app was opened.');process.exitCode=1});child.unref();
 if(child.pid)fs.writeFileSync(path.join(root,'PROTOTYPE-PROCESS.json'),JSON.stringify({pid:child.pid,version:receipt.version,executable:receipt.executable},null,2));
 console.log('Opened the isolated fictional prototype. Modes are available in setup and Settings. Quit through its QA tray icon. Your installed application/profile is not used.');
}catch(error){console.error('Prototype launch refused:',error.message);process.exitCode=1}
