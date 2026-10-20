const fs=require('node:fs');const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'],copy={};
for(const [index,line] of fs.readFileSync('scripts/localization/learn-content.txt','utf8').split(/\r?\n/).entries()){
 if(!line.trim()||line.startsWith('#'))continue;
 const [id,field,...values]=line.split('|');if(values.length!==7||values.some(v=>!v.trim()))throw Error('Invalid Learn row '+(index+1));
 copy[id]??={};for(let i=0;i<7;i++){copy[id][languages[i]]??={};if(copy[id][languages[i]][field])throw Error('Duplicate '+id+field);copy[id][languages[i]][field]=values[i]}
}
const target='src/core/learnCopy.json',serialized=JSON.stringify(copy,null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==serialized)throw Error('Learn copy is stale')}else fs.writeFileSync(target,serialized);
console.log(Object.keys(copy).length+' Learn lessons, seven authored languages');
