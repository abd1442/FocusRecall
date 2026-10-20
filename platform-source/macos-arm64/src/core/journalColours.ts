import approved from './journalColours.json'

export interface JournalColour {
  id:string;name:string;mode:'light'|'dark';sidebarMode:'light'|'dark'
  bg:string;surface:string;soft:string;paper:string;accent:string;recall:string;rest:string;overtime:string
  ink:string;muted:string;line:string;onAccent:string;navInk:string;navMuted:string;navActive:string;navOn:string;navLine:string;writingBg:string;writingInk:string
}
export type JournalLayout='light'|'dark'|'light-dark'|'dark-light'
export const APPROVED_COLOURS=approved as JournalColour[]
const paperLight=APPROVED_COLOURS.find(p=>p.id==='10')!
const graphiteDark=APPROVED_COLOURS.find(p=>p.id==='20')!
const paperDark:JournalColour={...graphiteDark,id:'paper-dark',name:'Paper & Ink · dark',bg:'#242522',surface:'#30312C',soft:'#3C3E36',paper:'#1C1E1B',accent:'#D9CEB5',recall:'#CBB9DC',rest:'#B8CEB6',overtime:'#E4BF87',ink:'#EEEDE6',muted:'#C0C3B8',line:'#55594E',onAccent:'#24271F',navInk:'#EEEDE6',navMuted:'#C0C3B8',navActive:'#D9CEB5',navOn:'#24271F',navLine:'#494D42',writingBg:'#292B25',writingInk:'#EEEDE6'}
export const PAPER_COLOURS:JournalColour[]=[
  {...paperLight,id:'paper-light',name:'Paper & Ink · light'},
  paperDark,
  {...paperDark,id:'paper-light-dark',name:'Paper & Ink · light sidebar / dark',sidebarMode:'light',paper:paperLight.paper,navInk:paperLight.navInk,navMuted:paperLight.navMuted,navActive:paperLight.navActive,navOn:paperLight.navOn,navLine:paperLight.navLine},
  {...paperLight,id:'paper-dark-light',name:'Paper & Ink · dark sidebar / light',sidebarMode:'dark',paper:paperDark.paper,navInk:paperDark.navInk,navMuted:paperDark.navMuted,navActive:paperDark.navActive,navOn:paperDark.navOn,navLine:paperDark.navLine}
]
const sageDark:JournalColour={...paperDark,id:'sage-dark',name:'Sage · all dark',bg:'#1C231D',surface:'#29322A',soft:'#354035',paper:'#172018',accent:'#ABC7A4',recall:'#D1B6C6',rest:'#D3C79B',overtime:'#E4AE85',ink:'#E4E9DA',muted:'#BDC9B3',line:'#4C5A49',onAccent:'#203421',navInk:'#E4E9DA',navMuted:'#BDC9B3',navActive:'#ABC7A4',navOn:'#203421',navLine:'#4C5A49',writingBg:'#232C24',writingInk:'#E4E9DA'}
/** The original Paper & Ink / Sage family, including its sidebar/workspace reverse. */
export const SAGE_COLOURS:JournalColour[]=[
 {...paperLight,id:'sage-light',name:'Sage notebook · all light',bg:'#E5E9DF',surface:'#F8FAF2',soft:'#DCE3D4',paper:'#F1F5EA',accent:'#416B53',recall:'#805D79',rest:'#526D54',overtime:'#946020',ink:'#2E473A',muted:'#56654F',line:'#C8D2BD',onAccent:'#FFFAF0',navInk:'#2E473A',navMuted:'#56654F',navActive:'#416B53',navOn:'#FFFAF0',navLine:'#C8D2BD',writingBg:'#F8FAF2',writingInk:'#2E473A'},
 sageDark,
 {...sageDark,id:'sage-paper-dark',name:'Original Paper & Ink + Sage dark',sidebarMode:'light',paper:'#D6CAB0',navInk:'#293D38',navMuted:'#4D5545',navActive:'#3E5840',navOn:'#FFFAED',navLine:'#B6A685'},
 {...paperLight,id:'sage-dark-paper',name:'Reverse · Sage dark + Paper & Ink',sidebarMode:'dark',paper:sageDark.paper,navInk:sageDark.navInk,navMuted:sageDark.navMuted,navActive:sageDark.navActive,navOn:sageDark.navOn,navLine:sageDark.navLine}
]
export const JOURNAL_LAYOUTS:{id:JournalLayout;name:string;defaultId:string;referenceId:string}[]=[
  {id:'light',name:'All light',defaultId:'paper-light',referenceId:'10'},
  {id:'dark',name:'All dark',defaultId:'paper-dark',referenceId:'20'},
  {id:'light-dark',name:'Light sidebar / dark',defaultId:'paper-light-dark',referenceId:'30'},
  {id:'dark-light',name:'Dark sidebar / light',defaultId:'paper-dark-light',referenceId:'40'}
]
export function journalLayout(p:JournalColour):JournalLayout {
  return p.mode===p.sidebarMode?p.mode:p.sidebarMode==='light'?'light-dark':'dark-light'
}
export function journalColour(id:string,mode:'light'|'dark'):JournalColour|undefined {
  if(id.startsWith('windows-')){
    const fixed=id.slice(8)
    if(fixed.startsWith('paper-'))return PAPER_COLOURS[fixed==='paper-light'||fixed==='paper-dark'?(mode==='light'?0:1):(mode==='light'?3:2)]
    if(fixed.startsWith('sage-'))return fixed==='sage-dark-paper'?SAGE_COLOURS[mode==='light'?3:1]:fixed==='sage-paper-dark'?mode==='light'?PAPER_COLOURS[0]:SAGE_COLOURS[2]:SAGE_COLOURS[mode==='light'?0:1]
    const original=APPROVED_COLOURS.find(p=>'approved-'+p.id===fixed)
    if(!original)return undefined
    if(original.mode===mode)return original
    const n=Number(original.id),hue=(n-1)%10,group=Math.floor((n-1)/10)
    const targetGroup=group<2?(mode==='light'?0:1):group<4?(mode==='light'?3:2):(mode==='light'?0:1)
    return APPROVED_COLOURS[targetGroup*10+hue]
  }
  if(id==='paper-auto')return PAPER_COLOURS[mode==='light'?0:1]
  if(id==='sage-auto')return mode==='light'?PAPER_COLOURS[0]:SAGE_COLOURS[2]
  if(id==='sage-reverse-auto')return mode==='light'?SAGE_COLOURS[3]:SAGE_COLOURS[1]
  return PAPER_COLOURS.find(p=>p.id===id)??SAGE_COLOURS.find(p=>p.id===id)??APPROVED_COLOURS.find(p=>'approved-'+p.id===id)
}
/** One immutable layout; sorted colors only. The user's reference stays second. */
export function journalChoices(layout:JournalLayout):JournalColour[]{
  const config=JOURNAL_LAYOUTS.find(l=>l.id===layout)!
  const reference=APPROVED_COLOURS.find(p=>p.id===config.referenceId)!
  return [PAPER_COLOURS.find(p=>p.id===config.defaultId)!,reference,...SAGE_COLOURS.filter(p=>journalLayout(p)===layout),...APPROVED_COLOURS.filter(p=>journalLayout(p)===layout&&p.id!==reference.id)]
}
export const journalId=(p:JournalColour):string=>/^\d+$/.test(p.id)?'approved-'+p.id:p.id
