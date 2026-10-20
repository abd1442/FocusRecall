// QA captures for the theme system: runs the built app (out/) on a fictional
// profile under out/qa-temp, simulates a beta.27 profile with a custom Focus
// colour, and saves screenshots of the default pair and Settings → Appearance.
// Run after `npx electron-vite build`: node scripts/qa-theme-system.cjs
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process')
const root = path.resolve('out/qa-temp/theme-system-2026'), shots = path.join(root, 'shots')
fs.mkdirSync(shots, { recursive: true })
fs.writeFileSync(path.join(root, 'QA-FICTIONAL.txt'), 'FocusRecall fictional profile only\n')
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const electron = require('electron')

;(async () => {
  const app = cp.spawn(electron, ['.', '--remote-debugging-port=9392'], { cwd: path.resolve('.'), stdio: 'ignore', env: { ...process.env, FOCUSRECALL_DATA_DIR: root } })
  let ws
  try {
    let target
    for (let i = 0; i < 120 && !target; i++) { try { target = (await fetch('http://127.0.0.1:9392/json/list').then((r) => r.json())).find((t) => t.type === 'page' && t.url.endsWith('/out/renderer/index.html')) } catch {} await pause(250) }
    if (!target) throw Error('No main window')
    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let id = 0; const waiting = new Map()
    ws.onmessage = (m) => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id) }
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
    const run = async (expr) => { const d = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw Error(JSON.stringify(d.result.exceptionDetails)); return d.result?.result?.value }
    const shot = async (name) => { await pause(700); const d = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(d.result.data, 'base64')); console.log('shot', name) }
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await pause(2500)
    const invoke = (c, ...a) => run(`window.api.invoke(${JSON.stringify(c)},...${JSON.stringify(a)})`)
    await invoke('settings:set', 'starterGuideCompleted', true)
    await invoke('settings:set', 'language', 'en')
    const click = (name) => run(`(()=>{const b=[...document.querySelectorAll('button,[role=radio]')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===${JSON.stringify(name)});if(!b)throw Error('no '+${JSON.stringify(name)});b.click();return true})()`)
    await pause(800); await click('Skip guide').catch(() => {})
    const scroll = (sel) => run(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({block:'start'})`)

    // 1. A fresh profile: Ivory & Ink by day, Ink Dim at night.
    const fresh = await invoke('appearance:get')
    console.log('fresh', fresh.mode, fresh.lightTheme, fresh.darkTheme)
    await invoke('appearance:set', { ...fresh, mode: 'light' }); await click('Home'); await shot('home-light')
    await invoke('appearance:set', { ...fresh, mode: 'dark' }); await shot('home-dark')
    await click('Stats'); await pause(800); await shot('stats-dark')
    await invoke('appearance:set', { ...fresh, mode: 'light' }); await shot('stats-light')

    // 2. Settings → Appearance, light, dark and Arabic (RTL).
    await click('Settings'); await click('Appearance'); await pause(600)
    await shot('settings-appearance-light')
    await scroll('#appearance-sidebar'); await shot('settings-appearance-light-2')
    await scroll('#appearance-panel'); await shot('settings-appearance-light-3')
    await invoke('appearance:set', { ...fresh, mode: 'dark' }); await scroll('#appearance-theme'); await shot('settings-appearance-dark')
    await invoke('settings:set', 'language', 'ar'); await pause(500); await scroll('#appearance-theme'); await shot('settings-appearance-dark-arabic')
    await invoke('settings:set', 'language', 'en')

    // 3. A beta.27 profile with a custom Focus colour migrates through the real save path.
    const beta27 = { ...fresh }; for (const k of ['lightTheme', 'darkTheme', 'navTone', 'stageOverrides', 'focusIsAccent', 'surfaceOverrides']) delete beta27[k]
    const migrated = await invoke('appearance:set', { ...beta27, colourId: 'approved-14', accentId: 'palette', mode: 'light', customLight: { focus: '#7A3E9D' }, customDark: { focus: '#C9A7E8' } })
    const vars = await run(`({focus:getComputedStyle(document.documentElement).getPropertyValue('--fr-stage-focus').trim(),accent:getComputedStyle(document.documentElement).getPropertyValue('--tf-focus').trim(),theme:document.documentElement.dataset.frTheme})`)
    console.log('migrated', JSON.stringify({ light: migrated.lightTheme, dark: migrated.darkTheme, stage: migrated.stageOverrides, focusIsAccent: migrated.focusIsAccent }), JSON.stringify(vars))
    await scroll('#appearance-advanced'); await run(`document.querySelector('#appearance-advanced details')?.setAttribute('open','')`); await shot('settings-advanced-migrated')
    await invoke('appearance:set', fresh)
  } finally {
    try { ws?.close() } catch {}
    app.kill()
  }
})().catch((e) => { console.error(e); process.exitCode = 1 })
