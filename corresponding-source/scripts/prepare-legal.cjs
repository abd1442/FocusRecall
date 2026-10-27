// Deterministic local notices. No downloads, credentials, or user data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),legal=path.join(root,'resources/legal');
const normalize=text=>text.replace(/\r\n?/g,'\n');
const eula=normalize(fs.readFileSync(path.join(legal,'EULA.txt'),'utf8')).replace(/^\uFEFF/,'');
const escape=s=>s.replace(/[\\{}]/g,c=>'\\'+c).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0)+'?');
const rtf='{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Segoe UI;}}\\viewkind4\\uc1\\pard\\sa120\\f0\\fs20\n'+eula.split('\n').map(line=>escape(line)+'\\par').join('\n')+'\n}';
const queue=Object.keys(require('../package.json').dependencies).concat(['react','react-dom','zustand']).map(name=>({name,from:root})),seen=new Set(),packages=[];
function packageFolder(name,from){
 for(let dir=from;;dir=path.dirname(dir)){
  const candidate=path.join(dir,'node_modules',name);
  if(fs.existsSync(path.join(candidate,'package.json')))return candidate;
  if(dir===root||path.dirname(dir)===dir)break;
 }
 throw Error('Missing installed runtime package '+name);
}
while(queue.length){
 const {name,from}=queue.shift(),folder=packageFolder(name,from);if(seen.has(folder))continue;seen.add(folder);
 const p=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));queue.push(...Object.keys(p.dependencies||{}).map(name=>({name,from:folder})));
 const names=fs.readdirSync(folder).filter(n=>/^(?:licen[cs]e|copying|notice)(?:[.-]|$)/i.test(n)&&fs.statSync(path.join(folder,n)).isFile());
 if(name==='victory-vendor'){
  for(const child of fs.readdirSync(path.join(folder,'lib-vendor')))if(fs.existsSync(path.join(folder,'lib-vendor',child,'LICENSE')))names.push('lib-vendor/'+child+'/LICENSE');
 }
 assert.ok(names.length,'Review missing license text: '+name);
 const notices=names.map(n=>({file:n,text:normalize(fs.readFileSync(path.join(folder,n),'utf8'))}));
 if(name==='victory-vendor')notices.unshift({file:'Upstream v37.3.6 LICENSE.txt (https://github.com/FormidableLabs/victory/blob/v37.3.6/LICENSE.txt)',text:normalize(fs.readFileSync(path.join(legal,'Victory-LICENSE.txt'),'utf8'))});
 packages.push({name:p.name,version:p.version,license:p.license||'Review required',notices});
}
packages.sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version));
const text='FOCUSRECALL THIRD-PARTY NOTICES\n\nThis inventory covers the installed production dependency graph plus bundled React, React DOM and Zustand. Listed licenses apply to those components, not FocusRecall original code. Electron and Chromium notices are also supplied separately as LICENSE.electron.txt and LICENSES.chromium.html beside the executable.\n\n'+packages.map(p=>`${'='.repeat(72)}\n${p.name} ${p.version} | ${typeof p.license==='string'?p.license:JSON.stringify(p.license)}\n\n${p.notices.map(n=>n.file+'\n'+n.text).join('\n\n')}`).join('\n\n');
const outputs={'EULA.rtf':rtf,'THIRD-PARTY-NOTICES.txt':text};
for(const [name,content] of Object.entries(outputs)){const file=path.join(legal,name);if(process.argv.includes('--check'))assert.equal(normalize(fs.readFileSync(file,'utf8')),normalize(content),name+' is stale');else fs.writeFileSync(file,content)}
const receipt=packages.map(({name,version,license,notices})=>({name,version,license,files:notices.map(n=>n.file)}));
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(fs.readFileSync(path.join(legal,'inventory.json'),'utf8')),receipt,'License inventory is stale');else fs.writeFileSync(path.join(legal,'inventory.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({runtimePackages:packages.length,licenses:[...new Set(packages.map(p=>p.license))].sort(),eulaRtf:true,notices:true}));
