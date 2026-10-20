// Read-only scan; emits object IDs/path names, never matching secret values.
const cp=require('node:child_process'),fs=require('node:fs');
const objects=cp.execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8'}).trim().split('\n');
const patterns={secret:/(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/,workstation:/(?:A:[\\/]00-Claude Cowork|C:[\\/]Users[\\/]abd14)/i};
let count=0;const hits=[];
for(const row of objects){const [id,...parts]=row.split(' '),file=parts.join(' ');if(!/\.(?:ts|tsx|js|cjs|mjs|md|json|yml|vbs|html|css)$/.test(file))continue;const data=cp.execFileSync('git',['cat-file','blob',id],{encoding:'utf8',maxBuffer:5e6});count++;for(const [kind,pattern] of Object.entries(patterns))if(pattern.test(data))hits.push({id,file,kind});}
const images=objects.filter(r=>/docs\/(?:spec|design|branding)\/.*\.(?:png|jpg)$/.test(r)).length;
fs.mkdirSync('publication-local',{recursive:true});fs.writeFileSync('publication-local/history-scan.json',JSON.stringify({textBlobsChecked:count,patternHits:hits,historicalImageObjectsRequiringHumanReview:images,limit:'Pattern-based scan, not exhaustive secret/PII or binary visual clearance'},null,2));
console.log(JSON.stringify({textBlobsChecked:count,secretPatternHits:hits.filter(h=>h.kind==='secret').length,workstationPathHits:hits.filter(h=>h.kind==='workstation').length,historicalImageObjectsRequiringHumanReview:images}));
