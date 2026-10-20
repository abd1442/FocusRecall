const config=require('./scripts/platform-builder.cjs')('darwin');
// Engineering builds are ad-hoc signed for local native QA, not notarized.
// Use electron-builder.mac-signed.cjs only after signing resources are supplied.
// Every package must use this runner's compiled SQLite architecture. Explicit
// multi-arch targets override builder's CLI arch and can create invalid bundles.
config.mac={target:[{target:'dmg',arch:[process.arch]},{target:'zip',arch:[process.arch]}],category:'public.app-category.education',icon:'resources/focusrecall-icon.png',identity:'-',hardenedRuntime:true,notarize:false,artifactName:'FocusRecall-${version}-${arch}.${ext}'};
config.afterPack=require('./scripts/native-binding-proof.cjs').beforeSign;
module.exports=config;
