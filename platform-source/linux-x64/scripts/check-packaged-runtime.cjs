const fs=require('node:fs'),path=require('node:path');
module.exports=context=>{
 const walk=folder=>{for(const item of fs.readdirSync(folder,{withFileTypes:true})){
  const file=path.join(folder,item.name);if(item.isDirectory())walk(file);else if(/\.log$/i.test(item.name))throw Error('Generated log in package: '+item.name);
 }};walk(context.appOutDir);
}
