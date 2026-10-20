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
  if (file.startsWith('corresponding-source/')) continue
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
const readme=fs.readFileSync('README.md','utf8');assert.ok(readme.includes('GPL-3.0-only'));assert.ok(readme.includes('Quick Mode')&&readme.includes('Full Mode'));assert.ok(readme.slice(readme.lastIndexOf('---')).includes('assets/support-kofi-banner.png'));assert.ok(readme.slice(readme.lastIndexOf('---')).includes('https://ko-fi.com/abd442'));assert.ok(manifest.images.every(image=>image.version===manifest.version));assert.ok(manifest.workflow.records.every(r=>r.focus_seconds>=120));
assert.ok(fs.readFileSync('LICENSE', 'utf8').includes('GNU GENERAL PUBLIC LICENSE'))
console.log('PASS links, tracked-file boundaries, bounded secret/path patterns, GPL materials and screenshot hashes. Not history/rights clearance.')

for(const heading of ["## Two ways to study","## A Full Mode session","## The floating timer","## Home tools","## History and notes","## Stats","## Learn","## Themes, text and language","## Privacy","## Backups and updates","## Install","## Help"]) assert.ok(readme.includes(heading), heading);
const guide=fs.readFileSync('docs/USER_GUIDE.md','utf8');for(const heading of ["## Your first study session","## Home tools","## Read Stats","## Appearance and language","## Install, update and protect your records","## If something goes wrong"]) assert.ok(guide.includes(heading), heading);
for(const m of readme.matchAll(/(?:src|srcset)="([^"]+)"/g)) if(!/^[a-z]+:/i.test(m[1])) assert.ok(fs.existsSync(m[1]), 'README image '+m[1]);

// A release tag must carry the exact curated source mapped to its binary.
if(fs.existsSync('RELEASE_SOURCE.json')){
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