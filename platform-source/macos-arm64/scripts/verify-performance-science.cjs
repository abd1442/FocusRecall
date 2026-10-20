// Reuse accepted scientific checks with new output receipts, preserving prior
// audit evidence. These scripts use fictional histories and source bundles only.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const output='docs/verification/performance-20261018/science';fs.mkdirSync(output,{recursive:true});
for(const file of ['scripts/verify-statistical-math.cjs','scripts/verify-recommendation-policy.cjs']){
 const filename=path.resolve(file),script=new Module(filename,module);script.filename=filename;script.paths=Module._nodeModulePaths(path.dirname(filename));
 const source=fs.readFileSync(filename,'utf8').replaceAll('docs/verification/statistical-validity-20261017',output).replaceAll('docs/verification/recommendation-policy-20261017',output);
 script._compile(source,filename);
}
