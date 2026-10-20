import {afterEach,expect,it,vi} from 'vitest'
import {LinuxLockWatch,lockProviders,parseLockReply,type LockTransport} from '../main/linuxLock'
const provider=lockProviders('GNOME')[0]
afterEach(()=>vi.useRealTimers())
function fixture(read:LockTransport['read']=async()=> 'active'){
 let line:(s:string)=>void=()=>{},exit:()=>void=()=>{};const stop=vi.fn(),changed=vi.fn()
 const io:LockTransport={read,watch:(_p,l,e)=>{line=l;exit=e;queueMicrotask(()=>l(`The name ${provider.name} is owned by :1.2`));return stop}}
 const watch=new LinuxLockWatch(changed,io,[provider]);return{watch,changed,stop,line:(s:string)=>line(s),exit:()=>exit(),signal:(active:boolean)=>line(`${provider.path}: ${provider.iface}.ActiveChanged (${active},)`) }
}
it('uses known desktop lock interfaces and strict boolean replies',()=>{
 expect(lockProviders('ubuntu:GNOME').length).toBe(2);expect(lockProviders('KDE')).toHaveLength(1);expect(lockProviders('unknown')).toEqual([])
 expect(parseLockReply('(false,)\n')).toBe('active');expect(parseLockReply('(true,)')).toBe('locked')
 for(const text of ['false','(false)','(false,)\nprivate text',''])expect(parseLockReply(text)).toBe('unknown')
})
it('delivers short lock pulses between polling intervals',async()=>{
 const f=fixture();await f.watch.start();expect(f.watch.state).toBe('active');f.changed.mockClear()
 f.signal(true);f.signal(false);expect(f.changed.mock.calls.map(c=>c[0])).toEqual(['locked','active']);f.watch.dispose();expect(f.stop).toHaveBeenCalledOnce()
})
it('does not let a stale initial unlocked reply override a lock event',async()=>{
 let reply!:(s:'active')=>void;const f=fixture(()=>new Promise(resolve=>{reply=resolve}));const pending=f.watch.start();await Promise.resolve();f.signal(true);await pending;reply('active');await Promise.resolve();expect(f.watch.state).toBe('locked');f.watch.dispose()
})
it('fails closed on owner loss and ignores late queries after dispose',async()=>{
 const f=fixture();await f.watch.start();f.line(`The name ${provider.name} does not have an owner`);expect(f.watch.state).toBe('unknown');f.watch.dispose();f.signal(false);expect(f.watch.state).toBe('unknown')
})
it('fails closed on monitor crash and can reconnect without a tight retry loop',async()=>{
 const f=fixture();await f.watch.start();f.exit();expect(f.watch.state).toBe('unknown');await f.watch.start();expect(f.watch.state).toBe('unknown');f.watch.dispose()
})
it('missing service, invalid queries and subscription failures never prove unlocked',async()=>{
 const f=fixture(async()=> 'unknown');await f.watch.start();expect(f.watch.state).toBe('unknown');f.watch.dispose()
 const broken=new LinuxLockWatch(vi.fn(),{read:async()=> 'active',watch:()=>{throw Error('blocked')}},[provider]);await broken.start();expect(broken.state).toBe('unknown');broken.dispose()
})
