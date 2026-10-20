// Generate a NEW marked fictional seed with the existing deterministic demo
// generator. Runs only SQLite seeding in Electron's Node runtime, never the app.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]),weeks=Number(process.argv[3]||156);
assert.ok(root.startsWith(path.resolve('out/qa-temp')+path.sep));assert.ok(!fs.existsSync(root));assert.ok(Number.isInteger(weeks)&&weeks>=18&&weeks<=520);
fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'QA-FICTIONAL.txt'),'FocusRecall fictional profile only');
const entry=`import {openDatabase} from './src/main/db/database';import {seedDemo} from './src/main/demo';
globalThis.__AUDIT_WEEKS=${weeks};const db=openDatabase(${JSON.stringify(path.join(root,'learnalyt-demo.db'))});seedDemo(db,Date.parse('2026-10-17T12:00:00Z'));console.log(JSON.stringify(db.prepare('SELECT (SELECT COUNT(*) FROM sessions) sessions,(SELECT COUNT(*) FROM blocks) blocks,(SELECT COUNT(*) FROM window_activity) activity').get()));db.pragma('wal_checkpoint(TRUNCATE)');db.close();`;
const target=path.join(root,'seed.cjs');
require('esbuild').buildSync({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},outfile:target,bundle:true,platform:'node',external:['better-sqlite3'],alias:{'@core/demo':path.resolve('docs/audit-beta27/repro/demo-weeks-shim.ts'),'@core':path.resolve('src/core')}});
const env={...process.env,ELECTRON_RUN_AS_NODE:'1'};
cp.execFileSync(path.resolve('node_modules/electron/dist/electron.exe'),[target],{env,windowsHide:true,stdio:'inherit'});
