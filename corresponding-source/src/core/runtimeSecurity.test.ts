import {it,expect,vi} from 'vitest'
import {FORBIDDEN_PRODUCTION_SWITCHES,unsafeRuntimeSwitches} from './runtimeSecurity'
it('uses the native parsed switch API, including empty values, rather than argv string patterns',()=>{
 for(const switchName of FORBIDDEN_PRODUCTION_SWITCHES){
  const hasSwitch=vi.fn(name=>name===switchName)
  expect(unsafeRuntimeSwitches({hasSwitch})).toBe(true)
  expect(hasSwitch).toHaveBeenCalledWith(switchName)
 }
 expect(unsafeRuntimeSwitches({hasSwitch:()=>false})).toBe(false)
})
it('covers both debug transports, origin relaxation, launchers and sandbox bypasses',()=>{
 for(const name of ['remote-debugging-port','remote-debugging-pipe','remote-allow-origins','single-process','no-sandbox','disable-gpu-sandbox','renderer-cmd-prefix','js-flags'])expect(FORBIDDEN_PRODUCTION_SWITCHES).toContain(name)
})

it('preserves Electron native file-UI defaults without treating them as a debug request',()=>{expect(unsafeRuntimeSwitches({hasSwitch:name=>name==='allow-file-access-from-files'})).toBe(false)})
