const config=require('./electron-builder.mac.cjs');
if(process.platform!=='darwin')throw Error('Signed macOS builds require a native Mac.');
if(!process.env.APPLE_TEAM_ID || !process.env.CSC_NAME)throw Error('Supply the approved Developer ID Application signing identity and Apple team before signing.');
if(!((process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD)||(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER)))throw Error('Supply approved notarization credentials through the build environment.');
config.forceCodeSigning=true;
config.mac.identity=process.env.CSC_NAME;
config.mac.notarize=true;
module.exports=config;
