// Native CI only: production fuses remain separate and are checked before this build.
const fs=require('node:fs'),path=require('node:path');
if(!['linux','darwin'].includes(process.platform))throw Error('Native Linux/macOS QA only.');
const config=require(process.platform==='linux'?'./electron-builder.linux.cjs':'./electron-builder.mac.cjs');
config.productName='FocusRecall QA';config.appId='app.focusrecall.qa';
config.directories.output='dist/'+process.platform+'-qa';
config.beforePack=()=>{if(JSON.parse(fs.readFileSync('out/main/build-profile.json','utf8')).profile!=='qa')throw Error('QA build required')};
config.electronFuses.enableNodeCliInspectArguments=true;
const afterPack=config.afterPack;
config.afterPack=async context=>{if(typeof afterPack==='function')await afterPack(context);else require('./scripts/check-packaged-runtime.cjs')(context);fs.writeFileSync(path.join(context.appOutDir,'QA_BUILD.txt'),'FocusRecall inspector-enabled fictional-profile QA build. DO NOT DISTRIBUTE.\n')};
module.exports=config;
