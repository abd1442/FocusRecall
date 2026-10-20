import { Notification } from 'electron'

export interface Notifier {
  /** A short, silent native notification. Never brings the app to the front. */
  quiet(title: string, body: string): void
}

export const windowsNotifier: Notifier = {
  quiet(title, body) {
    if (!Notification.isSupported()) return
    new Notification({ title, body, silent: true }).show()
  }
}

const liveReminders=new Set<Notification>()
/** OS acceptance does not guarantee a banner: Windows controls presentation. */
export function sendStudyReminder(title:string,body:string,onClick:()=>void):Promise<boolean>{
  if(!Notification.isSupported())return Promise.resolve(false)
  return new Promise(resolve=>{
    let done=false
    const finish=(accepted:boolean):void=>{if(!done){done=true;clearTimeout(timeout);resolve(accepted)}}
    const timeout=setTimeout(()=>finish(false),5000)
    try{
      const notification=new Notification({title,body,silent:false,urgency:'normal'})
      liveReminders.add(notification)
      notification.once('show',()=>finish(true))
      notification.once('failed',()=>{liveReminders.delete(notification);finish(false)})
      notification.on('click',onClick)
      notification.once('close',()=>liveReminders.delete(notification))
      setTimeout(()=>liveReminders.delete(notification),30*60000).unref()
      notification.show()
    }catch{finish(false)}
  })
}
