// Deterministic authoring transform. Never generate translations or fallbacks.
const fs=require('node:fs');
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'],copy={};
for(const [i,line] of fs.readFileSync('scripts/localization/advice-stage2.txt','utf8').split(/\r?\n/).entries()){
 if(!line.trim()||line.startsWith('#'))continue;
 const [id,field,...values]=line.split('|');
 if(values.length!==7||values.some(v=>!v.trim())||!['action','detail'].includes(field))throw Error('Invalid advice copy row '+(i+1));
 copy[id]??={};for(let j=0;j<7;j++){copy[id][languages[j]]??={};if(copy[id][languages[j]][field])throw Error('Duplicate '+id+field);copy[id][languages[j]][field]=values[j]}
}
const serialized=JSON.stringify(copy,null,2)+'\n',target='src/core/adviceCopy.json';
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==serialized)throw Error('Advice copy is stale')}else fs.writeFileSync(target,serialized);
console.log(Object.keys(copy).length+' advice concepts, seven authored languages');
const brief={};for(const line of fs.readFileSync('scripts/localization/advice-brief.txt','utf8').split(/\r?\n/)){
 if(!line.trim()||line.startsWith('#'))continue;const [id,...values]=line.split('|');
 if(!copy[id]||brief[id]||values.length!==7||values.some(v=>!v.trim()))throw Error('Invalid concise advice row: '+id);
 brief[id]=Object.fromEntries(languages.map((l,i)=>[l,values[i]]));
}
if(Object.keys(brief).length!==Object.keys(copy).length)throw Error('Every canonical strategy needs a concise prompt');
const briefText=JSON.stringify(brief,null,2)+'\n',briefFile='src/core/adviceBriefCopy.json';
if(process.argv.includes('--check')){if(fs.readFileSync(briefFile,'utf8')!==briefText)throw Error('Concise advice copy is stale')}else fs.writeFileSync(briefFile,briefText);
