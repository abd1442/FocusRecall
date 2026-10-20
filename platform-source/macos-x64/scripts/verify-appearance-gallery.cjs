// Packaged QA of the single theme gallery: Light/Dark/Follow Windows, all 26 themes,
// keyboard, Arabic RTL, scaling and persistence across restart. New fictional profile only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open,pause}=require('./lib/theme-qa.cjs');
const approved=JSON.parse(fs.readFileSync('docs/design/theme-system-2026/tokens/themes.json','utf8')).themes;
const locales=['en','ar'],catalogs=Object.fromEntries(locales.map(l=>[l,JSON.parse(fs.readFileSync('src/core/locales/'+l+'.json'))])),t=(l,k)=>catalogs[l][k]||k;
const output=process.env.FOCUSRECALL_GALLERY_OUTPUT||'docs/verification/appearance-gallery-20261019',root=process.env.FOCUSRECALL_GALLERY_QA_ROOT||'out/qa-temp/appearance-gallery-'+Date.now();
const results={success:false,checks:[],screenshots:[],systemAppearance:'Electron nativeTheme override; the Windows setting itself is unchanged'};
const pass=c=>{results.checks.push(c);console.log('ok  '+c)};
(async()=>{
 let q=await open({root,output});
 try{
  let {page,invoke,main}=q;
  const settings=async(l='en')=>{await page.getByRole('button',{name:t(l,'Settings'),exact:true}).click();await page.getByRole('navigation',{name:t(l,'Settings pages'),exact:true}).getByRole('button',{name:t(l,'Appearance'),exact:true}).click();await page.locator('#appearance-theme').waitFor()};
  const frTheme=()=>page.evaluate(()=>document.documentElement.dataset.frTheme);
  const active=id=>page.waitForFunction(id=>document.documentElement.dataset.frTheme===id,id);
  const mode=(m,l='en')=>page.getByRole('radiogroup',{name:t(l,'Mode'),exact:true}).locator(`[data-radio="${m}"]`);
  const gallery=()=>page.locator('#palette-gallery [role="radiogroup"]');
  const tabs=()=>page.getByRole('tab');
  const shot=async(file,label)=>{const el=page.locator('#appearance-theme');await el.evaluate(e=>e.scrollIntoView({block:'start'}));await pause(250);const b=await el.boundingBox(),v=page.viewportSize()||await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
   await page.screenshot({path:path.join(output,file),clip:{x:Math.max(0,b.x-16),y:Math.max(0,b.y-16),width:Math.min(b.width+32,v.width-Math.max(0,b.x-16)),height:Math.min(b.height+32,v.height-Math.max(0,b.y-16))}});results.screenshots.push({file,label})};
  const noOverflow=async()=>{const s=await page.evaluate(()=>{const sec=document.querySelector('#appearance-theme'),r=sec.getBoundingClientRect();let p=sec.parentElement;while(p&&p.scrollWidth<=p.clientWidth+2&&p!==document.body)p=p.parentElement;return {w:innerWidth,s:document.documentElement.scrollWidth,inner:p&&p!==document.body?p.scrollWidth-p.clientWidth:0,spill:[...sec.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>r.right+2||b.left<r.left-2)}).length}});assert.ok(s.s<=s.w+2&&s.inner<=2&&s.spill===0,'no horizontal overflow '+JSON.stringify(s))};
  const native=v=>main.evaluate(`qaElectron.nativeTheme.themeSource=${JSON.stringify(v)};true`);

  const fresh=await invoke('appearance:get');assert.deepEqual([fresh.mode,fresh.lightTheme,fresh.darkTheme],['system','ivory-ink','ink-dim']);
  await native('light');await settings();

  // Follow Windows: one gallery, two tabs; the tab on screen is selected first.
  assert.equal(await tabs().count(),2);assert.equal(await page.locator('[data-palette-tab="light"]').getAttribute('aria-selected'),'true');
  assert.equal(await gallery().getByRole('radio').count(),11);pass('Follow Windows opens on the theme Windows is showing (light), 11 light themes');
  await shot('system-light.png','Follow Windows, editing the light theme');
  await page.locator('[data-palette-tab="dark"]').click();assert.equal(await gallery().getByRole('radio').count(),15);
  await gallery().getByRole('radio',{name:'Deep Sea dark theme',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-palette-tab="dark"]').textContent.includes('Deep Sea'));
  assert.equal((await invoke('appearance:get')).darkTheme,'deep-sea');assert.equal(await frTheme(),'ivory-ink');pass('Dark tab edits the saved dark theme without changing the light screen; tab shows the new name');
  await shot('system-dark-tab.png','Follow Windows, editing the dark theme');
  await native('dark');await active('deep-sea');assert.equal(await page.locator('[data-palette-tab="dark"]').getAttribute('aria-selected'),'true');pass('Windows switching to dark shows Deep Sea');
  await native('light');await active('ivory-ink');
  // Tabs keyboard: arrows switch, roving tab stop.
  await page.locator('[data-palette-tab="light"]').click();await page.locator('[data-palette-tab="light"]').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.paletteTab),'dark');assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(),1);
  await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.paletteTab),'light');pass('Tabs: arrows and Home/End move and select; one tab stop');

  // Light mode: the gallery becomes the light theme only, no tabs, with a note about the dark theme.
  await mode('light').click();await active('ivory-ink');assert.equal(await tabs().count(),0);assert.equal(await gallery().getByRole('radio').count(),11);
  assert.ok((await page.locator('#appearance-theme').innerText()).includes('Dark mode uses Deep Sea.'));pass('Light: single light gallery, no redundant controls, dark theme named');
  await shot('light.png','Light mode');
  await mode('dark').click();await active('deep-sea');assert.equal(await gallery().getByRole('radio').count(),15);
  assert.ok((await page.locator('#appearance-theme').innerText()).includes('Light mode uses Ivory & Ink.'));pass('Dark: single dark gallery, light theme named');
  await shot('dark.png','Dark mode');

  // Every approved theme is selectable from its own mode's gallery and applies immediately.
  assert.equal(approved.length,26);
  for(const th of approved){await mode(th.mode).click();const r=gallery().getByRole('radio',{name:th.name+' '+th.mode+' theme',exact:true});await r.scrollIntoViewIfNeeded();await r.click();await active(th.id);assert.equal(await r.getAttribute('aria-checked'),'true')}
  pass('All 26 themes selected through the gallery and applied');

  // Mode radio keyboard: one tab stop per radiogroup; arrows move and select.
  await mode('light').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await mode('light').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal((await invoke('appearance:get')).mode,'dark');
  await page.keyboard.press('ArrowRight');assert.equal((await invoke('appearance:get')).mode,'system');
  for(const g of await page.getByRole('radiogroup').all())assert.equal(await g.locator('[tabindex="0"]').count(),1);
  const sel=gallery().locator('[aria-checked="true"]');await sel.focus();const before=await sel.getAttribute('data-radio');await page.keyboard.press('ArrowRight');
  const after=await page.evaluate(()=>document.activeElement?.getAttribute('data-radio'));assert.notEqual(after,before);await active(after);pass('Keyboard: mode and gallery radios move with arrows; one tab stop per group');

  // Scaling and a narrow window.
  await invoke('appearance:set',{...(await invoke('appearance:get')),uiScale:1.6});await pause(300);await noOverflow();
  await main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).setContentSize(1000,820)');await pause(400);await noOverflow();
  await shot('scaled-160-narrow.png','Interface size 160% in a 1000 px window');pass('160% interface size and 1000 px window: no horizontal overflow');
  await invoke('appearance:set',{...(await invoke('appearance:get')),uiScale:1});
  await main.evaluate('qaElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith("/out/renderer/index.html")).setContentSize(1440,1000)');

  // Arabic RTL.
  await invoke('settings:set','language','ar');await settings('ar');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  await native('dark');await page.locator('[data-palette-tab="dark"]').waitFor();
  await page.locator('[role="tab"][aria-selected="true"]').focus();const from=await page.evaluate(()=>document.activeElement?.dataset.paletteTab);await page.keyboard.press('ArrowLeft');
  assert.notEqual(await page.evaluate(()=>document.activeElement?.dataset.paletteTab),from);await noOverflow();
  await shot('arabic-system.png','Arabic, Follow Windows');
  await mode('light','ar').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');await mode('light','ar').focus();await page.keyboard.press('ArrowLeft');
  assert.equal((await invoke('appearance:get')).mode,'dark');await shot('arabic-dark.png','Arabic, Dark mode');pass('Arabic: RTL layout, mirrored arrow keys, no overflow');
  await invoke('settings:set','language','en');

  // Persistence across a full restart.
  const saved={...(await invoke('appearance:get')),mode:'system',lightTheme:'library',darkTheme:'deep-sea'};await invoke('appearance:set',saved);
  assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);await q.close();
  q=await open({root,output,restart:true});({page,invoke,main}=q);
  const back=await invoke('appearance:get');assert.deepEqual([back.mode,back.lightTheme,back.darkTheme],['system','library','deep-sea']);
  await native('light');await active('library');await settings();
  assert.ok((await page.locator('[data-palette-tab="light"]').innerText()).includes('Library'));assert.ok((await page.locator('[data-palette-tab="dark"]').innerText()).includes('Deep Sea'));
  await shot('restart-library.png','After restart: Library light, Deep Sea dark');pass('Mode and both saved themes persist across restart');
  assert.deepEqual(q.errors,[]);assert.deepEqual(q.network,[]);
  results.success=true;
 }finally{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');await q.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
