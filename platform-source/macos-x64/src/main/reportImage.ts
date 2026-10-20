import { app, BrowserWindow } from 'electron'
import { safeReportHtml } from '@core/desktopSecurity'
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'

/** Render an already-styled report locally and capture its entire scroll height. */
export async function renderReportPng(html: string, width: number): Promise<Buffer> {
  if (html.length > 10_000_000 || !Number.isFinite(width) || width < 300 || width > 2400) throw new Error('The report is too large to export.')
  const win = new BrowserWindow({ show: false, width: Math.ceil(width), height: 800, webPreferences: { javascript: false, nodeIntegration: false, contextIsolation: true, sandbox: true, offscreen: true } })
  const folder = mkdtempSync(join(app.getPath('temp'), 'focusrecall-report-'))
  const file = join(folder, 'report.html')
  try {
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
    win.webContents.on('will-navigate',event=>event.preventDefault())
    writeFileSync(file, safeReportHtml(html), 'utf8')
    await win.loadFile(file)
    win.webContents.debugger.attach('1.3')
    await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: Math.ceil(width), height: 800, deviceScaleFactor: 1, mobile: false })
    const metrics = await win.webContents.debugger.sendCommand('Page.getLayoutMetrics')
    const height = Math.ceil(metrics.cssContentSize.height)
    if (height < 1 || height > 32000) throw new Error('The report is too long for one image. Try a month with fewer findings.')
    const result = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.ceil(width), height, scale: 1 } })
    return Buffer.from(result.data, 'base64')
  } finally {
    win.destroy()
    try { unlinkSync(file) } finally { rmdirSync(folder) }
  }
}
