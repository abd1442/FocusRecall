/** Query Chromium's parsed command line, never reimplement its platform parsing.
 * Node inspection/environment options are additionally disabled by executable fuses. */
export const FORBIDDEN_PRODUCTION_SWITCHES = [
  'remote-debugging-port','remote-debugging-pipe','remote-debugging-address','remote-debugging-socket-name','remote-debugging-io-pipes','remote-allow-origins',
  'inspect','inspect-brk','inspect-port','inspect-publish-uid',
  'single-process','no-sandbox','disable-sandbox','disable-gpu-sandbox','disable-setuid-sandbox','no-zygote',
  'renderer-cmd-prefix','utility-cmd-prefix','gpu-launcher','browser-subprocess-path','snapshot-blob',
  // Electron adds allow-file-access-from-files itself for its existing file UI.
  'allow-insecure-localhost','disable-web-security',
  'ignore-certificate-errors','ignore-certificate-errors-spki-list','allow-running-insecure-content',
  'load-extension','disable-site-isolation-trials','disable-features','js-flags'
] as const
export function unsafeRuntimeSwitches(commandLine: { hasSwitch(name:string):boolean }):boolean {
  return FORBIDDEN_PRODUCTION_SWITCHES.some(name=>commandLine.hasSwitch(name))
}
