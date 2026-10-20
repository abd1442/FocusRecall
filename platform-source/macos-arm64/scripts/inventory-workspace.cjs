// Metadata-only inventory. Never follows links or traverses protected data trees.
// No file contents are read; protected sizes are deliberately left unknown.
const fs = require('node:fs')
const path = require('node:path')
const root = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '..')
const output = process.argv[2]
if (!output) throw new Error('Usage: node scripts/inventory-workspace.cjs <receipt.json> [workspace]')
const protectedName = /private|recovery|backup|original|safety|personal/i
const rows = [], skipped = []
function scan(dir, depth = 0) {
  let bytes = 0, files = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name), rel = path.relative(root, file).replaceAll('\\', '/')
    const stat = fs.lstatSync(file)
    const verifiedReleaseBundle = ['dist/private-friend-rc2-20261018',
      'dist/private-friend-rc2-20261018/FocusRecall-beta28-rc2-private-test'].includes(rel)
    if (stat.isSymbolicLink() || (e.isDirectory() && protectedName.test(e.name) && !verifiedReleaseBundle)) {
      skipped.push({ path: rel, reason: stat.isSymbolicLink() ? 'link: not followed' : 'protected: not traversed' })
      continue
    }
    if (e.isDirectory()) {
      const child = scan(file, depth + 1)
      bytes += child.bytes; files += child.files
      if (depth < 3) rows.push({ path: rel, ...child })
    } else { bytes += stat.size; files++ }
  }
  return { bytes, files }
}
const total = scan(root)
const receipt = { scope: 'Logical file sizes only; excludes protected trees and links; not disk allocation', total, folders: rows.sort((a,b) => b.bytes-a.bytes), skipped }
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify({ total, largest: receipt.folders.slice(0, 22), excludedTrees: skipped.length }, null, 2))
