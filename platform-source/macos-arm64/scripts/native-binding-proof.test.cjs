const {test}=require('node:test'),assert=require('node:assert/strict');
const {machoSections}=require('./native-binding-proof.cjs');
function fixture(){const b=Buffer.alloc(256);b.writeUInt32LE(0xfeedfacf,0);b.writeUInt32LE(1,16);b.writeUInt32LE(152,20);b.writeUInt32LE(0x19,32);b.writeUInt32LE(152,36);b.writeUInt32LE(1,96);b.write('__text',104);b.write('__TEXT',120);b.writeBigUInt64LE(4n,144);b.writeUInt32LE(200,152);b.write('code',200);return b}
test('detects changes to compiled code',()=>{const a=fixture(),b=fixture();b[200]^=1;assert.notDeepEqual(machoSections(a),machoSections(b))});
test('ignores unrelated signature bytes outside sections',()=>{const a=fixture(),b=fixture();b[250]=99;assert.deepEqual(machoSections(a),machoSections(b))});
test('rejects truncated and out-of-bounds Mach-O input',()=>{assert.throws(()=>machoSections(fixture().subarray(0,150)));const a=fixture();a.writeUInt32LE(255,152);assert.throws(()=>machoSections(a))});
test('rejects wrong binary format',()=>assert.throws(()=>machoSections(Buffer.alloc(256))));
