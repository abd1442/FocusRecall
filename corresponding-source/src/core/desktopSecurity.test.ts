import { expect,it } from 'vitest'
import { roleCanInvoke,safeReportHtml,targetKind,trustedPage } from './desktopSecurity'
import { IPC_CHANNELS,validateIpcArgs } from './ipcValidation'
it('allows only the exact registered renderer document and role hash',()=>{
 const expected='file:///C:/app/resources/app.asar/out/renderer/index.html#panel'
 expect(trustedPage(expected,expected)).toBe(true)
 for(const url of ['https://evil.example/','file:///C:/private.html','data:text/html,x',expected+'?x=1',expected.replace('#panel','#capture')])expect(trustedPage(url,expected)).toBe(false)
})
it('constrains helper actions and panel settings independently of the preload',()=>{
 expect(roleCanInvoke('panel','settings:set',['panelExpanded',true])).toBe(true)
 for(const role of ['panel','capture','reasons'] as const){expect(roleCanInvoke(role,'backup:restore',['token'])).toBe(false);expect(roleCanInvoke(role,'notes:save',[{},true])).toBe(false)}
 expect(roleCanInvoke('panel','settings:set',['foregroundTrackingEnabled',true])).toBe(false)
 expect(roleCanInvoke('panel','panel:focus',[])).toBe(false)
 expect(roleCanInvoke('main','panel:focus',[])).toBe(true)
 expect(roleCanInvoke('capture','popup:ready',['reasons'])).toBe(false)
 expect(roleCanInvoke('panel','shell:open',['C:\\document.pdf'])).toBe(false)
})
it('validates runtime channels, arity, enums, finite data and key-specific settings',()=>{
 expect(IPC_CHANNELS).toHaveLength(156)
 expect(IPC_CHANNELS).toEqual(expect.arrayContaining(['advice:choose','advice:less','advice:reset','notes:delete']))
 expect(() => validateIpcArgs('music:command', ['toggle-every-player'])).toThrow()
 expect(roleCanInvoke('panel', 'music:command', ['play'])).toBe(false)
 expect(()=>validateIpcArgs('session:finishWrapUp',[[],'invalid'])).toThrow()
 expect(()=>validateIpcArgs('preparation:confirm',['yes'])).toThrow()
 expect(()=>validateIpcArgs('session:finishStudying',[1])).toThrow()
 expect(()=>validateIpcArgs('notes:search',[{}])).toThrow()
 expect(()=>validateIpcArgs('session:get',[])).not.toThrow()
 expect(()=>validateIpcArgs('session:get',[1])).toThrow()
 expect(()=>validateIpcArgs('unknown:run',[])).toThrow()
 expect(()=>validateIpcArgs('history:updateBlock',['100',{}])).toThrow()
 expect(()=>validateIpcArgs('settings:set',['foregroundTrackingEnabled','true'])).toThrow()
 expect(()=>validateIpcArgs('settings:set',['notionTokenEncrypted','secret'])).toThrow()
 expect(()=>validateIpcArgs('session:start',[{itemId:1,timerMode:'evil',targetSeconds:600}])).toThrow()
 expect(()=>validateIpcArgs('session:start',[{itemId:1,timerMode:'flow',targetSeconds:Infinity}])).toThrow()
 expect(()=>validateIpcArgs('session:start',[{itemId:1,timerMode:'flow',targetSeconds:600}])).not.toThrow()
 expect(()=>validateIpcArgs('settings:set',['panelPosition',JSON.parse('{"__proto__":{}}')])).toThrow()
 expect(()=>validateIpcArgs('settings:set',['studyReminderDailyTime','25:99'])).toThrow()
 expect(()=>validateIpcArgs('studyReminders:pause',['forever'])).toThrow()
})
it.each(['javascript:alert(1)','file:///C:/private.txt','\\\\server\\share\\file.txt','C:\\run.exe','C:\\run.ps1','C:\\doc.pdf:script','https://user:pass@example.com/','https://example.com/%0aevil'])('rejects unsafe external target %s',target=>expect(()=>targetKind(target)).toThrow())
it.each(['https://example.com/study','obsidian://open?vault=QA&file=Note','spotify:playlist:fictional','C:\\Study\\Note.pdf'])('permits supported user resources %s',target=>expect(()=>targetKind(target)).not.toThrow())
it.each(['C:\\run.exe ','C:\\run.exe.','C:\\run.pif','C:\\run.msc','C:\\run.application','C:\\run.docm','C:\\folder.\\Note.pdf','C:\\run.unknown'])('rejects disguised or unsupported Windows resources %s',target=>expect(()=>targetKind(target)).toThrow())
it('places a restrictive network and script policy before report content',()=>expect(safeReportHtml('<img src="https://evil.example">')).toMatch(/^<meta[^>]+default-src 'none'/))

it('restricts title deletion to the main renderer and validates its empty payload',()=>{expect(roleCanInvoke('panel','tracking:deleteTitles',[])).toBe(false);expect(roleCanInvoke('capture','tracking:deleteTitles',[])).toBe(false);expect(()=>validateIpcArgs('tracking:deleteTitles',[])).not.toThrow();expect(()=>validateIpcArgs('tracking:deleteTitles',[true])).toThrow()})
