// Inspector-enabled builds are LOCAL QA ARTIFACTS ONLY. Never distribute them.
module.exports={extends:'./electron-builder.yml',productName:'FocusRecall QA',appId:'app.focusrecall.qa',
  beforePack:()=>{if(JSON.parse(require('node:fs').readFileSync('out/main/build-profile.json','utf8')).profile!=='qa')throw Error('QA build required')},
  electronFuses:{enableNodeCliInspectArguments:true},
  artifactName:'FocusRecall-QA-${version}.${ext}',
  afterPack:async context=>{require('./scripts/check-packaged-runtime.cjs')(context);require('node:fs').writeFileSync(require('node:path').join(context.appOutDir,'QA_BUILD.txt'),'FocusRecall inspector-enabled fictional-profile QA build. DO NOT DISTRIBUTE.\n')}
}
