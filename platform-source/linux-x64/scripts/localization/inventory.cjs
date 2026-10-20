// A source inventory, not a claim of linguistic or whole-product certification.
const ts = require('typescript'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
const directory = 'src/core/locales';
const languages = ['ar','es','fr','zh-Hans','pt-BR','de'];
const english = JSON.parse(fs.readFileSync(path.join(directory,'en.json'),'utf8'));
const catalogs = Object.fromEntries(languages.map(l => [l,JSON.parse(fs.readFileSync(path.join(directory,l+'.json'),'utf8'))]));
const normalize = key => key.trim().replaceAll('…','...');
const crypto=require('node:crypto');
const generatedReview=JSON.parse(fs.readFileSync('scripts/localization/generated-review.json','utf8'));
const keys = new Map(), dynamic = [];
function add(key, file) { if (!key.trim()) return; const canonical=normalize(key); const entry=keys.get(canonical)??{key:key.trim(),sources:new Set()}; if(file)entry.sources.add(file.replaceAll('\\','/'));keys.set(canonical,entry); }
for (const key of Object.keys(english)) add(key);
for (const catalog of Object.values(catalogs)) for (const key of Object.keys(catalog)) add(key);
// Shared components localize these application-copy props internally. Their
// literal values were omitted by the original call-only scanner.
const copyProps = new Map([
  ['Row',['label','hint']], ['Section',['title','lead']], ['AdvancedRow',['title']], ['SettingGroup',['label']],
  ['Field',['label','hint']], ['Panel',['title','hint']], ['StatsSection',['title','lead']],
  ['Dialog',['title']], ['Kpi',['label','hint']], ['SettingIcon',['title']]
]);
for (const file of walk('src').filter(f=>/\.tsx?$/.test(f)&&!f.endsWith('.test.ts'))) {
  const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true,file.endsWith('.tsx')?4:3);
  const literal = n => {
    if(!n)return;
    if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)) add(n.text,file);
    else if(ts.isConditionalExpression(n)){literal(n.whenTrue);literal(n.whenFalse);}
    else if(ts.isArrayLiteralExpression(n))n.elements.forEach(literal);
  };
  const visit = n => {
    if(file.endsWith('localizedThemes.ts')&&ts.isVariableDeclaration(n)&&n.name.getText(sf)==='THEME_COLOUR_NAMES')literal(n.initializer);
    if(/appearance\.ts|journalColours\.ts|themeSeeds\.ts/.test(file)&&ts.isPropertyAssignment(n)&&n.name.getText(sf).replace(/"/g,'')==='name')literal(n.initializer);
    if(ts.isPropertyAssignment(n)&&['label','hint','lead'].includes(n.name.getText(sf))&&(file.includes('renderer')||/statsData|statsSections/.test(file)))literal(n.initializer);
    if(file.endsWith('StatsReadingGuide.tsx')&&ts.isPropertyAssignment(n)&&['text','steps'].includes(n.name.getText(sf)))literal(n.initializer);
    if(ts.isCallExpression(n)){
      const name=n.expression.getText(sf),index=name==='translate'?1:['uiText','t','heading','bullet'].includes(name)?0:-1;
      if(index>=0)literal(n.arguments[index]);
      if(['confirmAction','showMessage'].includes(name))for(const argument of n.arguments.slice(0,3))literal(argument);
    }
    if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
      const props=copyProps.get(n.tagName.getText(sf));
      if(props)for(const attribute of n.attributes.properties)if(ts.isJsxAttribute(attribute)&&props.includes(attribute.name.getText(sf)))literal(attribute.initializer);
    }
    if(file.endsWith('insightLocalization.ts')&&ts.isVariableDeclaration(n)&&n.name.getText(sf)==='titles'&&n.initializer&&ts.isObjectLiteralExpression(n.initializer))for(const property of n.initializer.properties)if(ts.isPropertyAssignment(property))literal(property.initializer);
    if(ts.isPropertyAssignment(n)&&['title','explanation','calculation','limitations','action'].includes(n.name.getText(sf))&&ts.isTemplateExpression(n.initializer))
      dynamic.push({file:file.replaceAll('\\','/'),line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,property:n.name.getText(sf),hash:crypto.createHash('sha256').update(n.initializer.getText(sf)).digest('hex')});
    if((ts.isNewExpression(n)||ts.isCallExpression(n))&&n.expression.getText(sf)==='Error')literal(n.arguments?.[0]);
    ts.forEachChild(n,visit);
  };visit(sf);
}
const entries=[...keys.values()].sort((a,b)=>a.key.localeCompare(b.key));
if(!process.argv.includes('--check'))fs.writeFileSync(path.join(directory,'en.json'),JSON.stringify(Object.fromEntries(entries.map(e=>[e.key,e.key])),null,2)+'\n');
const tokens = s => [...s.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(m=>m[1]).sort();
const reviewed=dynamic.filter(site=>generatedReview.some(review=>review.file===site.file&&review.property===site.property&&review.hash===site.hash));
const unresolved=dynamic.filter(site=>!reviewed.includes(site));
const report={scope:'Normalized application copy, shared props and literal error messages. Reviewed canonical templates have explicit display adapters; linguistic/layout validation remains separate.',releaseReady:false,englishKeys:entries.length,reviewedCanonicalProse:reviewed,unresolvedGeneratedProse:unresolved,languages:{}};
let incomplete=false;
for(const language of languages){
  const catalog=catalogs[language],available=new Set(Object.keys(catalog).map(normalize));
  for(const [key,value] of Object.entries(catalog)){assert.equal(typeof value,'string');assert.ok(value.trim(),language+': '+key);assert.deepEqual(tokens(value),tokens(key),language+': '+key);}
  const missing=entries.filter(e=>!available.has(normalize(e.key))).map(e=>({key:e.key,sources:[...e.sources]}));
  incomplete ||= !!missing.length;
  report.languages[language]={translatedEntries:Object.keys(catalog).length,missingStaticKeys:missing.length,missing};
}
const output=process.env.FOCUSRECALL_LOCALIZATION_OUTPUT||'docs/verification/localization-20261016';fs.mkdirSync(output,{recursive:true});
report.sourceCoverageComplete=!incomplete&&!unresolved.length;
fs.writeFileSync(path.join(output,'coverage.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,reviewedCanonicalProse:reviewed.length,unresolvedGeneratedProse:unresolved.length,languages:Object.fromEntries(Object.entries(report.languages).map(([l,r])=>[l,{translatedEntries:r.translatedEntries,missingStaticKeys:r.missingStaticKeys}]))},null,2));
if(process.argv.includes('--strict')&&(incomplete||unresolved.length))process.exitCode=1;
