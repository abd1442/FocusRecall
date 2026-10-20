const config=require('./scripts/platform-builder.cjs')('linux');
config.linux={target:[{target:'AppImage',arch:['x64']},{target:'deb',arch:['x64']}],category:'Education',icon:'resources/focusrecall-icon.png',executableName:'focusrecall',maintainer:'abd1442',artifactName:'FocusRecall-${version}-${arch}.${ext}',desktop:{entry:{Name:'FocusRecall',Comment:'Study timer, recall notes and local history',Terminal:'false',Categories:'Education;'}}};
module.exports=config;
