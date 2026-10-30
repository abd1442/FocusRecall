const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

const root = process.cwd()
const files = cp.execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const secret = /(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/
const privatePath = /(?:[AC]:[\\/]Users[\\/](?!Public[\\/])|A:[\\/]00-Claude Cowork)/i

for (const file of files) {
  assert.ok(!/^(?:src|native|node_modules|publication-local|out|dist)\//.test(file), file)
  assert.ok(!/\.(?:exe|db|sqlite3?|pem|pfx|key|zip|log)$/i.test(file), file)
  const bytes = fs.readFileSync(file)
  if (bytes.includes(0)) continue
  const text = bytes.toString('utf8')
  assert.ok(!secret.test(text), 'Credential pattern in ' + file)
  assert.ok(!privatePath.test(text), 'Workstation path in ' + file)
  // Exact source snapshots retain upstream documentation, which is not this site's navigation.
  // File boundaries, credentials and workstation-path checks above still cover every source file.
  if (file.startsWith('corresponding-source/') || file.startsWith('platform-source/')) continue
  if (!file.endsWith('.md')) continue
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1].split('#')[0]
    if (!link || /^[a-z]+:/i.test(link)) continue
    const target = path.resolve(path.dirname(file), decodeURIComponent(link))
    assert.ok(target.startsWith(root + path.sep) && fs.existsSync(target), file + ': ' + link)
  }
}

const manifest = JSON.parse(fs.readFileSync('screenshots/current/manifest.json', 'utf8'))
assert.ok(manifest.fictionalOnly && manifest.rendererPreloadMatchesVerifiedCandidate && !manifest.artworkRightsCleared)
for (const image of manifest.images) {
  const bytes = fs.readFileSync('screenshots/current/' + image.file)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), image.sha256, image.file)
}
const readme=fs.readFileSync('README.md','utf8');assert.ok(readme.includes('GPL-3.0-only'));assert.ok(readme.includes('Quick Mode')&&readme.includes('Full Mode'));assert.ok(readme.slice(readme.lastIndexOf('---')).includes('assets/support-a14-pomodoro.svg'));assert.ok(readme.slice(readme.lastIndexOf('---')).includes('https://ko-fi.com/abd442'));assert.ok(manifest.images.every(image=>image.version===manifest.version));assert.ok(manifest.workflow.records.every(r=>r.focus_seconds>=120));
assert.ok(fs.readFileSync('LICENSE', 'utf8').includes('GNU GENERAL PUBLIC LICENSE'))
console.log('PASS links, tracked-file boundaries, bounded secret/path patterns, GPL materials and screenshot hashes. Not history/rights clearance.')

for(const heading of ["## Two ways to study","## A Full Mode session","## The floating timer","## Home tools","## History and notes","## Stats","## Learn","## Themes, text and language","## Privacy","## Backups and updates","## Install","## Help"]) assert.ok(readme.includes(heading), heading);
const guide=fs.readFileSync('docs/USER_GUIDE.md','utf8');for(const heading of ["## Your first study session","## Home tools","## Read Stats","## Appearance and language","## Install, update and protect your records","## If something goes wrong"]) assert.ok(guide.includes(heading), heading);
for(const m of readme.matchAll(/(?:src|srcset)="([^"]+)"/g)) if(!/^[a-z]+:/i.test(m[1])) assert.ok(fs.existsSync(m[1]), 'README image '+m[1]);

// A release tag must carry the exact curated source mapped to its binary.
if(fs.existsSync('RELEASE_SOURCE.json') && !fs.existsSync('RELEASE-MANIFEST.json')){
 const release=JSON.parse(fs.readFileSync('RELEASE_SOURCE.json','utf8'))
 const folder=path.resolve('corresponding-source')
 const source=JSON.parse(fs.readFileSync(path.join(folder,'SOURCE_MANIFEST.json'),'utf8'))
 assert.equal(source.sourceCommit,release.originalBuildSource)
 for(const row of source.files){
  const file=path.resolve(folder,row.file)
  assert.ok(file.startsWith(folder+path.sep)&&!fs.lstatSync(file).isSymbolicLink(),'Unsafe source path')
  assert.equal(crypto.createHash('sha256').update(cp.execFileSync('git',['show','HEAD:corresponding-source/'+row.file],{maxBuffer:16*1024*1024})).digest('hex'),row.sha256,row.file)
 }
 assert.match(release.binary.sha256,/^[a-f0-9]{64}$/)
 assert.match(release.correspondingSource.sha256,/^[a-f0-9]{64}$/)
 console.log('PASS release source revision, curated file hashes and source/binary mapping.')
}
// Verify both the current release and retained immutable earlier releases.
const current = JSON.parse(fs.readFileSync('corresponding-source/SOURCE_MANIFEST.json', 'utf8'))
if(fs.existsSync('screenshots/a14-pomodoro/manifest.json')){
 const branded=JSON.parse(fs.readFileSync('screenshots/a14-pomodoro/manifest.json','utf8'))
 assert.equal(branded.productName,'A14 Pomodoro');assert.equal(branded.status,'unreleased-development');assert.ok(branded.fictionalOnly)
 for(const row of branded.images){assert.ok(!/[\\/]/.test(row.file));assert.equal(crypto.createHash('sha256').update(fs.readFileSync('screenshots/a14-pomodoro/'+row.file)).digest('hex'),row.sha256,row.file)}
 assert.ok(readme.includes('assets/a14-pomodoro-lockup.svg'))
 assert.ok(!readme.includes('assets/focusrecall-lockup'))
 console.log('PASS current A14 Pomodoro brand assets and fictional screenshot hashes.')
}
assert.ok(['unreleased-development','published-beta'].includes(current.status))
assert.match(current.sourceCommit,/^[a-f0-9]{40}$/)
for(const row of current.files){
 const file=path.resolve('corresponding-source',row.file)
 assert.ok(file.startsWith(path.resolve('corresponding-source')+path.sep)&&!fs.lstatSync(file).isSymbolicLink())
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),row.sha256,row.file)
}
function verifyRelease(release){
 assert.match(release.version,/^\d+\.\d+\.\d+-beta\.\d+$/)
 assert.equal(release.tag,'v'+release.version)
 assert.ok(release.artifacts.length>0)
 const requests=[]
 for(const artifact of release.artifacts){
  assert.match(artifact.sha256,/^[a-f0-9]{64}$/)
  assert.match(artifact.sourceCommit,/^[a-f0-9]{40}$/)
  const folder=path.resolve(artifact.sourceFolder)
  assert.ok(folder.startsWith(root+path.sep))
  const live=artifact.sourceFolder==='corresponding-source'&&artifact.sourceCommit===current.sourceCommit
  const source=live?current:JSON.parse(cp.execFileSync('git',['show',release.tag+':'+artifact.sourceFolder+'/SOURCE_MANIFEST.json'],{encoding:'utf8'}))
  assert.equal(source.sourceCommit,artifact.sourceCommit)
  assert.equal(source.version,release.version)
  for(const row of source.files){
   assert.ok(!/[\r\n\0]/.test(row.file))
   const file=path.resolve(folder,row.file)
   assert.ok(file.startsWith(folder+path.sep),'Unsafe source path')
   requests.push({ref:live?artifact.sourceCommit:release.tag,rel:path.relative(root,file).split(path.sep).join('/'),sha256:row.sha256})
  }
 }
 const batch=cp.execFileSync('git',['cat-file','--batch'],{input:requests.map(r=>r.ref+':'+r.rel+'\n').join(''),maxBuffer:128*1024*1024})
 let offset=0
 for(const row of requests){
  const end=batch.indexOf(10,offset);assert.ok(end>offset)
  const header=batch.subarray(offset,end).toString('utf8').split(' ')
  assert.equal(header[1],'blob',row.rel)
  const size=Number(header[2]);assert.ok(Number.isSafeInteger(size)&&size>=0)
  offset=end+1;const bytes=batch.subarray(offset,offset+size);assert.equal(bytes.length,size)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256,row.rel)
  offset+=size;assert.equal(batch[offset++],10)
 }
 assert.equal(offset,batch.length)
 assert.match(release.sourceDelivery.sha256,/^[a-f0-9]{64}$/)
 assert.match(release.notices.sha256,/^[a-f0-9]{64}$/)
 console.log('PASS '+release.tag+' source/binary mapping and '+requests.length+' exact source hashes.')
}
if(fs.existsSync('RELEASE-MANIFEST.json'))verifyRelease(JSON.parse(fs.readFileSync('RELEASE-MANIFEST.json','utf8')))
if(fs.existsSync('release-history'))for(const file of fs.readdirSync('release-history').filter(f=>f.endsWith('RELEASE-MANIFEST.json')))verifyRelease(JSON.parse(fs.readFileSync(path.join('release-history',file),'utf8')))
assert.ok(!fs.existsSync('corresponding-source/src/renderer/src/components/ParkedThoughts.tsx'))
console.log('PASS current source hashes and retained prior release mapping.')
