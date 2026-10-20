// Rebuild the comparison engine from the accepted parent, without checking out
// or modifying any files. Audit generator is read only; its evidence is untouched.
const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),esbuild=require('esbuild');
async function build(){
 const root=process.cwd(),outfile=path.join(root,'out/qa-temp/final-stats-baseline.cjs');fs.mkdirSync(path.dirname(outfile),{recursive:true});
 await esbuild.build({stdin:{contents:"export * from './src/core/evidence';export {compareFactor,rankFactors,DEFAULT_ANALYSIS} from './src/core/insights';export {history,baseFactors,manyFactors} from './docs/audit-final-20261018/repro/gen';",resolveDir:root},bundle:true,platform:'node',format:'cjs',outfile,plugins:[{name:'accepted-parent',setup(b){b.onLoad({filter:/[\\/]src[\\/].*\.tsx?$/},a=>({contents:cp.execFileSync('git',['show','5d6ad2f:'+path.relative(root,a.path).replaceAll('\\','/')],{encoding:'utf8',windowsHide:true}),loader:a.path.endsWith('tsx')?'tsx':'ts'}))}}]});
 return outfile;
}
module.exports={build};
