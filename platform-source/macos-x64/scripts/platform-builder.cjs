// Shared production configuration. Packaging must run on the target OS.
const fs=require('node:fs'),path=require('node:path'),yaml=require('js-yaml');
module.exports=(platform)=>{
 const base=yaml.load(fs.readFileSync(path.join(__dirname,'../electron-builder.yml'),'utf8'));
 delete base.win;delete base.nsis;delete base.electronDist;
 // build-platform compiles explicitly with SQLite's force_build=1. A second
 // builder rebuild can clean it and select the dependency's no-op target.
 base.npmRebuild=false;
 base.buildDependenciesFromSource=true;
 base.files=[...base.files.filter(f=>f!=='!node_modules/better-sqlite3/build/**'),'!resources/native/**','!node_modules/better-sqlite3/prebuilds/**','!node_modules/better-sqlite3/prebuilds-unused/**','!node_modules/better-sqlite3/build/!(Release)/**','!node_modules/better-sqlite3/build/Release/!(better_sqlite3.node)'];
 base.asarUnpack=['node_modules/better-sqlite3/**'];
 base.directories.output='dist/'+platform+'-engineering';
 // Chromium/Electron exposes embedded ASAR integrity on Windows/macOS only.
 // Keep the Linux capability difference explicit; do not claim enforcement.
 if(platform==='linux')base.electronFuses.enableEmbeddedAsarIntegrityValidation=false;
 return base;
};
