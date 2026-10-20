// Independent SciPy oracle for the in-app Student-t arithmetic; no study data.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve('out/qa-temp/statistical-tools');fs.mkdirSync(root,{recursive:true});
const bundle=path.join(root,'math.cjs');require('esbuild').buildSync({entryPoints:['src/core/statisticalMath.ts'],bundle:true,platform:'node',outfile:bundle});
const math=require(bundle),cases=[];
for(const df of [1,2,3,4,7,10,30,100,1000])for(const alpha of [.5,.1,.05,.01,.001,.00001,.0000001])cases.push({df,alpha,critical:math.studentCritical(df,alpha)});
const source="import sys,json,scipy; from scipy.stats import t; rows=json.load(sys.stdin); print(json.dumps({'version':scipy.__version__,'rows':[dict(r,reference=float(t.isf(r['alpha']/2,r['df']))) for r in rows]}))";
const reference=JSON.parse(cp.execFileSync('python',['-c',source],{input:JSON.stringify(cases),encoding:'utf8',windowsHide:true}));
let maxRelativeError=0,maxTailError=0;
for(const r of reference.rows){const error=Math.abs(r.critical-r.reference)/r.reference;maxRelativeError=Math.max(error,maxRelativeError);maxTailError=Math.max(maxTailError,Math.abs(math.studentTwoSidedP(r.reference,r.df)-r.alpha));assert.ok(error<1e-8,JSON.stringify(r));}
const result={cases:cases.length,oracle:'SciPy '+reference.version,maxRelativeError,maxTailError,passed:true};
fs.writeFileSync('docs/verification/statistical-validity-20261017/math-oracle.json',JSON.stringify(result,null,2)+'\n');console.log(result);
