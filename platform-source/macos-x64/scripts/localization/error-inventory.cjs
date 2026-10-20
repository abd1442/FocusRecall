const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const keys=new Set();
for(const file of [...walk('src/core'),...walk('src/main')].filter(f=>/\.ts$/.test(f)&&!f.endsWith('.test.ts'))){const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true);const visit=n=>{if((ts.isNewExpression(n)||ts.isCallExpression(n))&&n.expression.getText(sf)==='Error'&&n.arguments?.[0]&&ts.isStringLiteral(n.arguments[0]))keys.add(n.arguments[0].text);ts.forEachChild(n,visit)};visit(sf)}
const ar=JSON.parse(fs.readFileSync('src/core/locales/ar.json','utf8')),missing=[...keys].filter(key=>!ar[key]).sort();
fs.writeFileSync('out/localization-errors.json',JSON.stringify(missing,null,2));console.log(missing.length+' messages');console.log(missing.join('\n'));
