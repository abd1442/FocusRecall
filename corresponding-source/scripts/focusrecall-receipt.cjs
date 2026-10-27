// Read-only verification of the existing current receipt; never invent test results.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const version=require('../package.json').version,tag=version.replace('0.1.0-','').replace('.','');
const dir=path.join('dist','focusrecall-'+tag),receipt=JSON.parse(fs.readFileSync(path.join(dir,'verification.json')));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
assert.equal(receipt.product,'FocusRecall');assert.equal(receipt.version,version);
for(const row of receipt.artifacts){assert.equal(fs.statSync(row.file).size,row.bytes);assert.equal(hash(row.file),row.sha256)}
assert.equal(hash('resources/focusrecall.ico'),(receipt.icon||receipt.centredIcon).sha256);
console.log(JSON.stringify({version,artifacts:receipt.artifacts.length,allHashesMatch:true,receiptReadOnly:true}));
