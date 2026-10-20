// Production-fuse internal test archives. Never include a QA app or test data.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
if(!['linux','darwin'].includes(process.platform))throw Error('Prepare on the native build host');
if(JSON.parse(fs.readFileSync('out/main/build-profile.json')).profile!=='production')throw Error('Production build required');
const platform=process.platform,arch=process.arch,tag=platform==='darwin'?'macos':'linux',name=`FocusRecall-internal-${tag}-${arch}`;
const folder=path.resolve('dist',name);fs.mkdirSync(folder);let executable,limit;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(platform==='darwin'){
 const app=path.resolve('dist/darwin-engineering',arch==='arm64'?'mac-arm64':'mac','FocusRecall.app');
 cp.execFileSync('/usr/bin/ditto',[app,path.join(folder,'FocusRecall.app')]);executable='"$base/FocusRecall.app/Contents/MacOS/FocusRecall"';limit=130;
}else{
 const deb=fs.readdirSync('dist/linux-engineering').find(f=>f.endsWith('.deb'));if(!deb)throw Error('Missing native DEB');
 fs.copyFileSync(path.join('dist/linux-engineering',deb),path.join(folder,deb));executable='"/opt/FocusRecall/focusrecall"';limit=150;
 fs.writeFileSync(path.join(folder,'INSTALLER-SHA256.txt'),hash(path.join(folder,deb))+'  '+deb+'\n');
}
const launcher=`#!/bin/sh
set -eu
base=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd)
data="$base/fictional-test-data"
if [ -L "$data" ]; then echo "Refusing a linked test-data directory."; exit 1; fi
if [ ! -e "$data" ]; then
  mkdir -m 700 "$data"
  printf '%s\\n' 'FocusRecall fictional internal testing only' > "$data/INTERNAL-FICTIONAL.txt"
fi
if [ ! -f "$data/INTERNAL-FICTIONAL.txt" ] || [ "$(cat "$data/INTERNAL-FICTIONAL.txt")" != 'FocusRecall fictional internal testing only' ]; then
  echo "Refusing an unmarked data directory. Nothing was changed."; exit 1
fi
${platform==='linux'?'if [ ! -x /opt/FocusRecall/focusrecall ]; then echo "Install the included DEB on a disposable test system first."; exit 1; fi\n':''}exec env FOCUSRECALL_DATA_DIR="$data" LEARNALYT_DATA_DIR="$data" TRIFOCUS_DATA_DIR="$data" ${executable}
`;
fs.writeFileSync(path.join(folder,platform==='darwin'?'Start FocusRecall.command':'Start FocusRecall.sh'),launcher,{mode:0o755});
const sha=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(path.join(folder,'READ-ME.txt'),`Unpublished FocusRecall internal test build (${tag} ${arch}).\n${platform==='darwin'?'Keep this folder intact. Open Start FocusRecall.command; do not replace anything in Applications. The app is ad-hoc signed, without Developer ID or notarization. If macOS blocks it, record the warning; do not disable Gatekeeper.':'On a disposable Linux test system/account with no existing FocusRecall installation, install the included DEB using the normal software installer, then run Start FocusRecall.sh. GNOME/KDE, loginctl and gdbus are currently required for observed study timing.'}\nThe launcher uses fictional-test-data beside itself, separate from normal study profiles. Never enter personal data.\nTry Quick and Full, both timer styles, pause/switch/finish, a break, restart/recovery and a manual backup/restore. Record any lock/sleep/wake problem; closed/locked time must not become focus time.\nSource commit: ${sha}\nMatching GPL-3.0-only source: https://github.com/abd1442/FocusRecall-Dev/tree/${sha} (private). Provide source access if sharing with another tester. License and third-party notices are bundled in the application.\n`);
const archive=folder+(platform==='darwin'?'.zip':'.tar.gz');
if(platform==='darwin')cp.execFileSync('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',folder,archive]);
else cp.execFileSync('tar',['-czf',archive,'-C',path.dirname(folder),path.basename(folder)]);
if(fs.statSync(archive).size>limit*1024*1024)throw Error('Internal archive exceeds its free-storage safety cap; do not upload');
fs.writeFileSync(archive+'.sha256',hash(archive)+'  '+path.basename(archive)+'\n');
console.log(JSON.stringify({internalArchive:path.basename(archive),bytes:fs.statSync(archive).size,sha256:hash(archive),source:sha,qa:false,personalData:false}));
