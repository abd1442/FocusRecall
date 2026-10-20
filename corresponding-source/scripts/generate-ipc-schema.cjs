// Derive the runtime boundary schema from the checked-in IPC contract.
// Run after changing API/settings types, then commit the generated schema.
const ts=require('typescript'),fs=require('node:fs');
const config=ts.readConfigFile('tsconfig.node.json',ts.sys.readFile).config;
const parsed=ts.parseJsonConfigFileContent(config,ts.sys,process.cwd());
const program=ts.createProgram([...parsed.fileNames,'src/core/api.ts'],parsed.options),checker=program.getTypeChecker();
const definitions={},seen=new Map();let next=0;
function schema(type){
 if(type.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown))return {kind:'json'};
 if(type.flags&ts.TypeFlags.Never)return {kind:'never'};
 if(type.flags&ts.TypeFlags.Undefined)return {kind:'undefined'};
 if(type.flags&ts.TypeFlags.Null)return {kind:'literal',value:null};
 if(type.flags&ts.TypeFlags.StringLiteral)return {kind:'literal',value:type.value};
 if(type.flags&ts.TypeFlags.NumberLiteral)return {kind:'literal',value:type.value};
 if(type.flags&ts.TypeFlags.BooleanLiteral)return {kind:'literal',value:type.intrinsicName==='true'};
 if(type.flags&ts.TypeFlags.String)return {kind:'string'};
 if(type.flags&ts.TypeFlags.Number)return {kind:'number'};
 if(type.flags&ts.TypeFlags.Boolean)return {kind:'boolean'};
 if(seen.has(type.id))return {kind:'ref',id:seen.get(type.id)};
 const id=String(++next);seen.set(type.id,id);definitions[id]={kind:'never'};
 let result;
 if(type.isUnion())result={kind:'union',options:type.types.map(schema)};
 else if(checker.isTupleType(type)){
  const elements=checker.getTypeArguments(type),flags=type.target.elementFlags;
  result={kind:'tuple',items:elements.map(schema),minimum:flags.filter(f=>!(f&ts.ElementFlags.Optional)).length};
 }else if(checker.isArrayType(type))result={kind:'array',item:schema(checker.getTypeArguments(type)[0])};
 else {
  const properties={};
  for(const p of checker.getPropertiesOfType(type))properties[p.name]={optional:!!(p.flags&ts.SymbolFlags.Optional),schema:schema(checker.getTypeOfSymbolAtLocation(p,p.valueDeclaration||p.declarations[0]))};
  const index=checker.getIndexTypeOfType(type,ts.IndexKind.String)||checker.getIndexTypeOfType(type,ts.IndexKind.Number);
  result={kind:'object',properties,...(index?{index:schema(index)}:{})};
 }
 definitions[id]=result;return {kind:'ref',id};
}
const api=program.getSourceFile('src/core/api.ts'),contract=api.statements.find(s=>ts.isInterfaceDeclaration(s)&&s.name.text==='IpcContract');
const channels={};for(const member of contract.members){const t=checker.getTypeAtLocation(member),p=checker.getPropertyOfType(t,'args');channels[member.name.text]=schema(checker.getTypeOfSymbolAtLocation(p,p.valueDeclaration));}
const eventNode=api.statements.find(s=>ts.isInterfaceDeclaration(s)&&s.name.text==='EventContract');
const settingsFile=program.getSourceFile('src/core/settings.ts'),settingsNode=settingsFile.statements.find(s=>ts.isInterfaceDeclaration(s)&&s.name.text==='AppSettings');
const settings={};for(const m of settingsNode.members)settings[m.name.text]=schema(checker.getTypeAtLocation(m));
const output=JSON.stringify({channels,events:eventNode.members.map(m=>m.name.text),settings,definitions},null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync('src/core/ipc-schema.json','utf8')!==output)throw Error('IPC schema is stale. Run node scripts/generate-ipc-schema.cjs.');}
else fs.writeFileSync('src/core/ipc-schema.json',output);
console.log(`Generated schemas for ${Object.keys(channels).length} channels, ${Object.keys(settings).length} settings and ${next} shared types.`);
