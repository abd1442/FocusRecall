// Reuse the numerical oracle and recommendation-policy cases with NEW receipts.
// This stage intentionally changes inference; the policy comparison runs both
// old/new recommendation rules on the SAME current engine. Protected inference
// arithmetic, timing, canonical advice and Learn remain checked separately.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const output='docs/verification/statistical-reliability-20261018/science';fs.mkdirSync(output,{recursive:true});
for(const file of ['scripts/verify-statistical-math.cjs','scripts/verify-recommendation-policy.cjs','scripts/verify-scientific-stats.cjs']){
 const filename=path.resolve(file),script=new Module(filename,module);script.filename=filename;script.paths=Module._nodeModulePaths(path.dirname(filename));
 let source=fs.readFileSync(filename,'utf8').replaceAll('docs/verification/statistical-validity-20261017',output).replaceAll('docs/verification/recommendation-policy-20261017',output).replaceAll('docs/verification/stats-stage1-20261016',output);
 if(file.endsWith('verify-recommendation-policy.cjs'))source=source.replace("const protectedFiles=['src/core/evidence.ts',","const protectedFiles=[").replace("scope:'Recorded associations retained; no method is promoted from immediate self-ratings. No changes to statistical calculations, timing or canonical advice/Learn.'","scope:'Legacy versus accepted recommendation rules, BOTH on the current uncertainty engine. No method prescription from self-ratings; timing, Student-t arithmetic, canonical advice and Learn protected. Inference intentionally changed in this remediation.'");
 script._compile(source,filename);
}
