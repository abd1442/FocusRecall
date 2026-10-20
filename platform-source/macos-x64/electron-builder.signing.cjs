// Opt-in signing overlay for electron-builder 26. No key material belongs here.
// Build: electron-builder --config electron-builder.signing.cjs --win --x64 --publish never
const fs=require('node:fs'),path=require('node:path'),yaml=require('js-yaml');
const certificateSha1=process.env.FOCUSRECALL_CERTIFICATE_SHA1||process.env.LEARNALYT_CERTIFICATE_SHA1;
if(!process.env.CSC_LINK&&!certificateSha1)throw Error('Configure a legitimate signing credential before using the signed-build overlay.');
const base=yaml.load(fs.readFileSync(path.join(__dirname,'electron-builder.yml'),'utf8'));
module.exports={...base,forceCodeSigning:true,publish:null,win:{...base.win,signtoolOptions:{signingHashAlgorithms:['sha256'],...(certificateSha1?{certificateSha1}:{})}}};
