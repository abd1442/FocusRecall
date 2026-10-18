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
  if (!file.endsWith('.md')) continue
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1].split('#')[0]
    if (!link || /^[a-z]+:/i.test(link)) continue
    const target = path.resolve(path.dirname(file), decodeURIComponent(link))
    assert.ok(target.startsWith(root + path.sep) && fs.existsSync(target), file + ': ' + link)
  }
}

const manifest = JSON.parse(fs.readFileSync('screenshots/current/manifest.json', 'utf8'))
assert.ok(manifest.fictionalOnly && manifest.rendererPreloadMatchesVerifiedRC2 && !manifest.artworkRightsCleared)
for (const image of manifest.images) {
  const bytes = fs.readFileSync('screenshots/current/' + image.file)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), image.sha256, image.file)
}
assert.ok(fs.readFileSync('README.md', 'utf8').includes('GPL-3.0-only'))
assert.ok(fs.readFileSync('LICENSE', 'utf8').includes('GNU GENERAL PUBLIC LICENSE'))
console.log('PASS links, tracked-file boundaries, bounded secret/path patterns, GPL materials and screenshot hashes. Not history/rights clearance.')
