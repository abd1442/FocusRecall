// Deliberately separate from build:win. Never changes production defaults.
const cp=require('node:child_process');
const run=(args)=>{const p=cp.spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,FOCUSRECALL_QA_BUILD:'1'}});if(p.status!==0)process.exit(p.status||1)};
run([process.env.npm_execpath || require('node:path').join(require('node:path').dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'run','build']);
run(['node_modules/electron-builder/cli.js','--win','--dir','--publish','never','--config','electron-builder.qa.cjs','--config.directories.output=dist/qa']);
