import { afterEach, expect, it, vi } from 'vitest'
import { parseLoginSession, LinuxSessionObserver } from '../main/linuxSession'
import { targetKind } from './desktopSecurity'
import { managedPanel, windowIcon, panelCanFocus,keepDockAlive } from '../main/platform'
import { timingUnavailable } from './platformMessages'
import { LANGUAGES } from './localization'

afterEach(()=>vi.useRealTimers())
it('requires explicit, active and unlocked session evidence',()=>{
  const graphical='Type=wayland\nClass=user\nUser=1000\n'
  expect(parseLoginSession(graphical+'LockedHint=no\nActive=yes\nState=active',1000)).toBe('active')
  for(const text of ['', 'LockedHint=no', 'Active=yes\nState=active', 'LockedHint=no\nActive=yes\nState=closing'])expect(parseLoginSession(text)).toBe('unknown')
  expect(parseLoginSession(graphical+'LockedHint=yes\nActive=yes\nState=active',1000)).toBe('locked')
  expect(parseLoginSession(graphical+'LockedHint=no\nActive=no\nState=online',1000)).toBe('locked')
  expect(parseLoginSession(graphical+'LockedHint=no\nActive=yes\nState=active',1001)).toBe('unknown')
  expect(parseLoginSession('Type=tty\nClass=user\nUser=1000\nLockedHint=no\nActive=yes\nState=active',1000)).toBe('unknown')
})
it('fails closed on lost/stale probes, never automatically resumes a session',async()=>{
  vi.useFakeTimers();const interrupt=vi.fn();let now=1000,state:'active'|'locked'|'unknown'='active'
  const observer=new LinuxSessionObserver(interrupt,async()=>state,()=>now)
  expect(observer.canObserve()).toBe(false);await observer.start();expect(observer.canObserve()).toBe(true)
  now+=3000;expect(observer.canObserve()).toBe(false)
  await vi.advanceTimersByTimeAsync(1000);expect(interrupt).toHaveBeenCalledOnce()
  state='locked';await vi.advanceTimersByTimeAsync(1000);expect(observer.canObserve()).toBe(false)
  state='unknown';await vi.advanceTimersByTimeAsync(1000);expect(observer.canObserve()).toBe(false)
  observer.dispose();state='active';await vi.advanceTimersByTimeAsync(2000);expect(observer.canObserve()).toBe(false)
})
it('handles rejected and in-flight probe disposal safely',async()=>{
  const observer=new LinuxSessionObserver(vi.fn(),async()=>{throw Error('permission denied')})
  await observer.start();expect(observer.canObserve()).toBe(false);observer.dispose()
})
it('opens POSIX documents without permitting executables or traversal',()=>{
  for(const os of ['linux','darwin']){
    expect(targetKind('/home/fictional/مراجعة notes.pdf',os)).toBe('path')
    for(const p of ['/tmp/run.sh','/tmp/run.desktop','/tmp/app.app','//server/file.pdf','/tmp/../note.pdf','/tmp/note.pdf\n'])expect(()=>targetKind(p,os)).toThrow()
  }
  expect(()=>targetKind('/home/fictional/note.pdf','win32')).toThrow()
})
it('keeps the native Windows panel and provides a Wayland fallback',()=>{
  expect(managedPanel('linux',{XDG_SESSION_TYPE:'wayland'})).toBe(true)
  expect(managedPanel('linux',{XDG_SESSION_TYPE:'x11'})).toBe(false)
  expect(managedPanel('win32',{WAYLAND_DISPLAY:'irrelevant'})).toBe(false)
  expect(windowIcon('linux')).toMatch(/focusrecall-icon\.png$/)
  expect(windowIcon('darwin')).toMatch(/focusrecall-icon\.png$/)
  expect(windowIcon('win32')).toMatch(/focusrecall\.ico$/)
  expect(panelCanFocus(false,'win32')).toBe(false);expect(panelCanFocus(true,'win32')).toBe(true)
  expect(panelCanFocus(false,'linux')).toBe(true);expect(panelCanFocus(false,'darwin')).toBe(true)
  expect(keepDockAlive('darwin')).toBe(true);expect(keepDockAlive('win32')).toBe(false);expect(keepDockAlive('linux')).toBe(false)
  for(const language of LANGUAGES)expect(timingUnavailable(language.id).length).toBeGreaterThan(30)
})
