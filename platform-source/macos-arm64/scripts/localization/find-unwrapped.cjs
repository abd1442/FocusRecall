const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const found=[];
for(const file of walk('src/renderer/src').filter(f=>f.endsWith('.tsx'))){const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true,4);
 const add=n=>{const text=n.text?.trim();if(text&&/[a-zA-Z]{2}/.test(text))found.push({file:file.replaceAll('\\','/'),line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,text})};
 const visit=n=>{if(ts.isJsxText(n))add(n);if(ts.isJsxAttribute(n)&&['title','placeholder','aria-label','alt'].includes(n.name.getText(sf))&&n.initializer&&ts.isStringLiteral(n.initializer))add(n.initializer);if(ts.isJsxExpression(n)&&n.expression&&(ts.isStringLiteral(n.expression)||ts.isConditionalExpression(n.expression))){const lit=x=>{if(ts.isStringLiteral(x))add(x);else if(ts.isConditionalExpression(x)){lit(x.whenTrue);lit(x.whenFalse)}};lit(n.expression)}ts.forEachChild(n,visit)};visit(sf);
}
fs.writeFileSync('out/localization-unwrapped.json',JSON.stringify(found,null,2));console.log(JSON.stringify(found,null,2));
