// Authored seven-language source; no runtime network or English fallback.
const fs=require('node:fs'),assert=require('node:assert/strict');
const languages=['en','ar','es','fr','zh-Hans','pt-BR','de'],copy={};
for(const line of fs.readFileSync('scripts/localization/learn-expansion.txt','utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'))){
 const [id,field,...values]=line.split('|');assert.equal(values.length,7,id+'.'+field);
 copy[id]??=Object.fromEntries(languages.map(l=>[l,{}]));
 languages.forEach((l,i)=>{assert.ok(values[i].trim());assert.equal(copy[id][l][field],undefined);copy[id][l][field]=values[i]});
}
for(const entries of Object.values(copy))for(const l of languages){assert.deepEqual(Object.keys(entries[l]).sort(),['action','caption','detail','keywords','labels','title']);assert.equal(entries[l].labels.split('¦').length,entries.en.labels.split('¦').length)}
const file='src/core/learnExpansionCopy.json',output=JSON.stringify(copy,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),output);else fs.writeFileSync(file,output);
console.log('Learn expansion: '+Object.keys(copy).length+' visual essays × seven languages');
const strategyCopy={};
for(const line of fs.readFileSync('scripts/localization/strategy-visuals.txt','utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'))){
 const [id,field,...values]=line.split('|');assert.equal(values.length,7,id+'.'+field);
 strategyCopy[id]??=Object.fromEntries(languages.map(l=>[l,{}]));
 languages.forEach((l,i)=>{assert.ok(values[i].trim());assert.equal(strategyCopy[id][l][field],undefined);strategyCopy[id][l][field]=values[i]});
}
for(const entries of Object.values(strategyCopy))for(const l of languages){assert.deepEqual(Object.keys(entries[l]).sort(),['caption','labels']);assert.equal(entries[l].labels.split('¦').length,3)}
const strategyFile='src/core/strategyVisualCopy.json',strategyOutput=JSON.stringify(strategyCopy,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(strategyFile,'utf8'),strategyOutput);else fs.writeFileSync(strategyFile,strategyOutput);
console.log('Strategy visuals: '+Object.keys(strategyCopy).length+' tailored scenes × seven languages');
const uiRows=fs.readFileSync('scripts/localization/learn-expansion-ui.txt','utf8').split(/\r?\n/).filter(l=>l.trim()).map(l=>l.split('|'));
for(const row of uiRows)assert.equal(row.length,7);
for(const [i,language] of languages.entries()){
 const filename='src/core/locales/'+language+'.json',catalog=JSON.parse(fs.readFileSync(filename,'utf8'));
 for(const row of uiRows){if(process.argv.includes('--check'))assert.equal(catalog[row[0]],row[i],language+': '+row[0]);else catalog[row[0]]=row[i]}
 if(!process.argv.includes('--check'))fs.writeFileSync(filename,JSON.stringify(catalog,null,2)+'\n');
}
