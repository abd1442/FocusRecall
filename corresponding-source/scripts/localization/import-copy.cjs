// Authoring data uses English | Arabic | Spanish | French | Simplified Chinese | pt-BR | German.
const fs=require('node:fs');
const files=process.argv.slice(2),languages=['ar','es','fr','zh-Hans','pt-BR','de'];
const catalogs=Object.fromEntries(languages.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json','utf8').replace(/^\uFEFF/,''))]));
for(const file of files)for(const [index,line] of fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
 if(!line.trim()||line.startsWith('#'))continue;
 const cells=line.split('|').map(cell=>cell.replaceAll('⏎','\n'));if(cells.length!==7)throw Error(file+':'+(index+1)+' expected seven columns, got '+cells.length);
 const [key,...translations]=cells;for(let i=0;i<6;i++){if(!translations[i].trim())throw Error('Empty translation '+key);catalogs[languages[i]][key]=translations[i]}
}
for(const l of languages)fs.writeFileSync('src/core/locales/'+l+'.json',JSON.stringify(Object.fromEntries(Object.entries(catalogs[l]).sort(([a],[b])=>a.localeCompare(b))),null,2)+'\n');
console.log('Translated entries per language:',Object.keys(catalogs.ar).length);
