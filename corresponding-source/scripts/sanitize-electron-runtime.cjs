// Remove generated logs only from electron-builder's newly copied runtime.
const fs=require('node:fs'),path=require('node:path');
module.exports=context=>{
 const root=path.resolve(context.appOutDir),dist=path.resolve('dist');
 if(!root.startsWith(dist+path.sep))throw Error('Runtime cleanup requires a package under dist.');
 const walk=folder=>{for(const item of fs.readdirSync(folder,{withFileTypes:true})){
  const file=path.join(folder,item.name);if(item.isSymbolicLink())throw Error('Unexpected link in packaged runtime.');
  if(item.isDirectory())walk(file);else if(/\.log$/i.test(item.name))fs.unlinkSync(file);
 }};walk(root);
}
