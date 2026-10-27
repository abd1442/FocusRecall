// Allowlisted PRIVATE source export: never stages, commits, deletes or changes Git history.
import { readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join, relative, dirname, sep, extname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const root=process.cwd()
// Git-tracked files only: generated files and historical evidence stay local.
const fixed=['SOURCE_BUILD.md','docs/RC_WINDOWS_TEST_PLAN.md','scripts/windows-install-check.ps1','scripts/prepare-dependency-sources.cjs','.gitattributes','.gitignore','LICENSE','README.md','CONTRIBUTING.md','SECURITY.md','package.json','package-lock.json','electron-builder.yml','electron-builder.qa.cjs','electron-builder.signing.cjs','electron.vite.config.ts','vitest.config.ts','tsconfig.json','tsconfig.node.json','tsconfig.web.json','docs/ASSETS.md','docs/LEGAL_REVIEW.md','docs/RELEASE_SECURITY.md','scripts/build-foreground.cjs','scripts/check-production-build.cjs','scripts/build-qa.cjs','scripts/publication.mjs','scripts/prepare-legal.cjs','scripts/generate-ipc-schema.cjs','scripts/make-chime.mjs','scripts/generate-themes.mjs','docs/design/theme-system-2026/tools/seeds.mjs','docs/design/theme-system-2026/tools/darks.mjs','docs/design/theme-system-2026/tools/color.mjs','docs/design/theme-system-2026/tokens/migration.json','docs/design/theme-system-2026/tokens/themes.json','scripts/sanitize-electron-runtime.cjs','scripts/check-packaged-runtime.cjs','scripts/verify-production-security.cjs','scripts/verify-asar-integrity.cjs','scripts/verify-release-hygiene.cjs'];
// Public-safe provenance receipts support the asset document's local links.
// Never broadly include verification/ (it also contains private/local evidence).
fixed.push('docs/ASSET_RIGHTS_AUDIT_20261018.md','docs/WORKSPACE.md','docs/USER_GUIDE.md','docs/RELEASE_STATUS.md','scripts/inventory-workspace.cjs',
 'docs/CURRENT_SOURCE.md',
 'docs/screenshots/current/manifest.json','docs/screenshots/current/home.png','docs/screenshots/current/appearance.png','docs/screenshots/current/stats.png','docs/screenshots/current/learn.png',
 'docs/verification/asset-rights-20261018/packaged-media.json',
 'docs/verification/asset-rights-20261018/inline-graphics.json',
 'docs/verification/asset-rights-20261018/library-comparison.json',
 'docs/verification/asset-rights-20261018/upstream/manifest.json',
 'docs/verification/asset-rights-20261018/chime.json');
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const files=tracked.filter(file=>fixed.includes(file)||['src/','native/','build/','scripts/','.github/'].some(prefix=>file.startsWith(prefix))||file.startsWith('resources/')&&!file.startsWith('resources/native/')).sort();
for(const required of fixed)if(!files.includes(required))throw Error('Required source file must be tracked before exporting: '+required);
const hash=b=>createHash('sha256').update(b).digest('hex')
const secrets=/(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/
const personal=/(?:[AC]:[\\/]Users[\\/](?!Public[\\/])|A:[\\/]00-Claude Cowork)/i
const rows=[],failures=[]
for(const file of files){
 const bytes=readFileSync(join(root,file))
 if(/\.(?:db(?:-wal|-shm|-journal)?|sqlite3?|pfx|pem|p12|key|log|tsbuildinfo|exe|dll|node|zip)$/i.test(file))failures.push(`${file}: unwanted file type`)
 if(!['.png','.wav'].includes(extname(file))){const text=bytes.toString('utf8');if(secrets.test(text))failures.push(`${file}: possible secret`);if(personal.test(text))failures.push(`${file}: workstation path`)}
 rows.push({file,bytes:bytes.length,sha256:hash(bytes)})
}
// Validate local documentation links without fetching external resources.
for(const file of files.filter(f=>f.endsWith('.md'))){
 const text=readFileSync(join(root,file),'utf8')
 for(const m of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  const link=m[1].split('#')[0];if(!link||/^[a-z]+:/i.test(link))continue
  const target=relative(root,resolve(root,dirname(file),link)).split(sep).join('/')
  if(!files.includes(target))failures.push(`${file}: link outside public package: ${link}`)
 }
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`PASS: ${files.length} allowlisted files; secret/path patterns and local Markdown links checked. Not an ownership or exhaustive secret certification.`)
if(process.argv.includes('--check'))process.exit(0)
const argument=process.argv.indexOf('--output')
const output=resolve(root,argument<0?'publication-local/gpl-source-20261018':process.argv[argument+1])
if(!output.startsWith(resolve(root,'publication-local')+sep))throw Error('Export must remain inside publication-local.')
if(existsSync(output))throw Error('Refusing to overwrite an existing review package; choose a fresh export name in this script.')
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
if(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw Error('Commit tracked source changes before exporting a matching release snapshot.')
mkdirSync(output,{recursive:true})
for(const file of files){const target=join(output,file);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,file),target)}
writeFileSync(join(output,'SOURCE_MANIFEST.json'),JSON.stringify({date:new Date().toISOString().slice(0,10),sourceCommit,scope:'Local GPL source review export. Existing Git history, verification archives, profiles, generated binaries and untracked files excluded. Not authorization to publish; verify corresponding-source obligations and asset provenance.',files:rows},null,2)+'\n')
console.log('Created '+relative(root,output)+' with SHA-256 file manifest.')
