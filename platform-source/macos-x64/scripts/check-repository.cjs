// Tracked-index check, not a claim that .gitignore or history is clean.
const fs=require('node:fs'),cp=require('node:child_process');
const files=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const errors=[],pathWarnings=[];
const secret=/(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/;
const workstation=/(?:[A-Z]:[\\/]Users[\\/](?!Public[\\/])|A:[\\/]00-Claude Cowork)/i;
for(const file of files){
 if(/^(?:out|dist|node_modules|publication-local)\/|private-recovery|user-data-backups|(?:^|\/)\.env(?:\.|$)|\.(?:db(?:-wal|-shm|-journal)?|sqlite3?|pem|pfx|p12|key|exe|dll|node|zip|log|heapsnapshot|cpuprofile)$/i.test(file))errors.push({file,reason:'private/generated/binary path'});
 if(!fs.existsSync(file)){errors.push({file,reason:'missing tracked file'});continue}
 if(fs.lstatSync(file).isSymbolicLink()){errors.push({file,reason:'tracked link requires explicit review'});continue}
 const b=fs.readFileSync(file);
 if(b.subarray(0,16).toString()==='SQLite format 3\0')errors.push({file,reason:'database signature'});
 if(b.includes(0))continue;
 const text=b.toString('utf8');if(secret.test(text))errors.push({file,reason:'credential pattern; matched value withheld'});
 if(workstation.test(text))pathWarnings.push(file);
}
const strict=process.argv.includes('--strict-paths');
console.log(JSON.stringify({trackedFiles:files.length,errors,pathWarnings,strictPaths:strict,scope:'Current tracked files only. Independently audit Git history, embedded archives and image provenance before sharing.'},null,2));
if(errors.length||strict&&pathWarnings.length)process.exitCode=1;
