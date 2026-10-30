const fs=require('node:fs'),path=require('node:path');
const base=path.resolve('docs/branding/a14-pomodoro/simple-badges');
for(const [source,target] of [['1-icon.svg','a14-pomodoro-icon.svg'],['1-light.svg','a14-pomodoro-lockup.svg'],['1-dark.svg','a14-pomodoro-lockup-dark.svg']]){
 let svg=fs.readFileSync(path.join(base,source),'utf8').replace(/aria-label="[^"]*"/,'aria-label="A14 Pomodoro"');
 fs.writeFileSync(path.resolve('resources',target),svg);
}
console.log('Exported approved Countdown Corner vector icon and light/dark lockups.');
