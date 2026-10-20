const fs=require('node:fs'),path=require('node:path');
module.exports=()=>{
 const profile=JSON.parse(fs.readFileSync('out/main/build-profile.json','utf8'));
 if(profile.profile!=='production')throw Error('Refusing to package QA output as production. Run npm run build without FOCUSRECALL_QA_BUILD.');
 const walk=folder=>{for(const item of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,item.name);if(item.isDirectory())walk(file);else if(/\.log$/i.test(item.name))throw Error('Generated log in build input: '+file)}};
 for(const folder of ['out/main','out/preload','out/renderer'])walk(folder);
}
