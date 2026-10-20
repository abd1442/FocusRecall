import { expect,it } from 'vitest'
import { LANGUAGES,translate } from './localization'
import { displayInsight,displayPreparationSuggestion,displayOrigin } from './insightLocalization'
import { localizedThemeName } from './localizedThemes'
import { APPROVED_COLOURS } from './journalColours'
import { factorCopy } from './localizedStats'
import { localizedDuration } from './localizedDuration'
import { localizedError } from './localizedError'
import { buildReport,markdownToHtml } from './report'
import { personalInsightsMarkdown,type PersonalInsight } from './personalInsights'
import { SEED_GROUPS,seedOptions,type LogField } from './logfields'

const seed=SEED_GROUPS.flatMap(g=>g.fields).find(f=>f.key==='place')!
const field:LogField={id:2,key:seed.key,label:seed.label,groupId:1,type:seed.type,options:seedOptions(seed.options),scale:null,sortOrder:0,archived:false}
const schema={groups:[],fields:[field]}
const card=(extra:Partial<PersonalInsight>={}):PersonalInsight=>({id:'field:2:Bedroom:focus',factorKey:'field:2',family:'conditions',context:'Place',title:'Canonical title',explanation:'Canonical explanation',calculation:'Canonical calculation',limitations:'Canonical limits',rows:[{label:'Bedroom',value:4,n:20},{label:'Other recorded setups',value:3,n:25}],n:20,nOther:25,days:8,daysOther:9,sessions:45,unit:'sessions',outcome:'focus',range:{from:'2026-10-01',to:'2026-10-15'},replicated:true,evidence:'Stronger evidence',action:'Canonical action',section:'factors',score:100,presentation:{trimmedDifference:.8,daily:false,includeUntouched:false,withinSubject:true,target:'Bedroom'},...extra})

for(const {id:language} of LANGUAGES){
  it(`preserves evidence and custom text while presenting generated comparisons in ${language}`,()=>{
    for(const family of ['time','sleep','conditions','length','rest','trend'] as const){
      const source=card({family}),before=JSON.stringify(source),shown=displayInsight(source,schema,language)
      expect(JSON.stringify(source)).toBe(before)
      expect(shown.rows.map(r=>[r.value,r.n])).toEqual(source.rows.map(r=>[r.value,r.n]))
      expect([shown.id,shown.score,shown.n,shown.nOther,shown.replicated,shown.evidence,shown.trial]).toEqual([source.id,source.score,source.n,source.nOther,source.replicated,source.evidence,source.trial])
      if(language!=='en')for(const prop of ['title','explanation','calculation','limitations','action'] as const){expect(shown[prop]).not.toBe(source[prop]);expect(shown[prop]).not.toMatch(/\{[A-Za-z]+\}/)}
    }
    const custom={...field,key:null,options:[{id:'custom',label:'Bedroom'}]}
    expect(factorCopy(language,{groups:[],fields:[custom]},{key:'field:2',label:'Place',group:'setup',multi:false,options:[]},'Bedroom')).toBe('Bedroom')
    const named=card({factorKey:'custom',context:'My private مادة 中文',rows:[{label:'Home <private>',value:4,n:20},{label:'Elsewhere',value:3,n:25}]})
    expect(displayInsight(named,schema,language).rows[0].label).toBe('Home <private>')
    expect(displayInsight(named,schema,language).context).toBe(named.context)
  })
  it(`localizes report headings and generated prose in ${language} without rendering private markup`,()=>{
    const shown=displayInsight(card(),schema,language),md=personalInsightsMarkdown([shown],language)
    expect(md).toContain(translate(language,'Personal study insights'))
    expect(md).toContain(shown.calculation)
    const empty=buildReport({language,schema,title:'Fictional <script>title</script>',periodLabel:'2026-10',previousLabel:'2026-09',sessions:[],previous:[],factors:[],options:{withinSubject:true,includeUntouched:false},itemName:()=> 'Private'})
    expect(empty).toContain(translate(language,'What was measured'))
    expect(empty).toContain(translate(language,'No sessions in this period.'))
    expect(markdownToHtml(empty)).not.toContain('<script>')
  })
}
it('uses the leading reason’s own day count and translates seeded reasons only by identity',()=>{
  const source=card({family:'distractions',outcome:null,unit:'events',rows:[{label:'Phone',value:7,n:7}],n:20,days:9,presentation:{leadingDays:3,automaticTracking:false}})
  const shown=displayInsight(source,schema,'de',[{id:'phone',label:'Phone'}])
  expect(shown.rows[0].label).toBe(translate('de','Phone'))
  expect(shown.explanation).toContain('3')
  expect(shown.explanation).not.toContain('9')
  expect(displayInsight(source,schema,'de',[{id:'private',label:'Phone'}]).rows[0].label).toBe('Phone')
  expect(displayInsight(source,schema,'de',[{id:'phone',label:'Phone'},{id:'private',label:'Phone'}]).rows[0].label).toBe('Phone')
})
it('localizes preparation explanations without replacing their canonical suggestion IDs',()=>{
  const source={id:'original',label:'Place: Bedroom',explanation:'Original',presentation:{factorKey:'field:2',context:'Place',option:'Bedroom',outcome:'focus',n:20,nOther:25,activity:true}}
  const shown=displayPreparationSuggestion(source,schema,'fr')
  expect(shown.id).toBe(source.id);expect(shown.label).not.toBe(source.label)
  expect(shown.explanation).toContain('20');expect(shown.explanation).toContain('25')
  expect(source.explanation).toBe('Original')
})
it('localizes duration units without changing numeric ordering or clock arithmetic',()=>{
  expect(localizedDuration(3720,'en')).toBe('1 h 02 min')
  expect(localizedDuration(3720,'ar')).toBe('1 س 02 د')
  expect(localizedDuration(3720,'zh-Hans')).toBe('1 小时 02 分钟')
  expect(localizedDuration(4,'de')).toBe('4 Sek.')
})
it('translates known validation errors and keeps unknown diagnostic details as text',()=>{
  const raw=new Error("Error invoking remote method 'test': Error: Unknown OS failure <tag>")
  expect(localizedError('en',raw)).toBe('Unknown OS failure <tag>')
  expect(localizedError('de',raw)).toContain('Details: Unknown OS failure <tag>')
  expect(localizedError('ar',new Error('Choose a subject.'))).toBe(translate('ar','Choose a subject.'))
})
it('summarizes historical evidence from structured counts without rewriting the original record',()=>{
  const source={id:'old',title:'Saved English finding',factorKey:'field:2',option:'Bedroom',outcome:'focus' as const,range:{from:'2026-10-01',to:'2026-10-15'},calculation:'Original calculation',limitations:'Original caveat',evidence:'Stronger evidence',contexts:[{itemId:1,activity:'reading'}],comparison:{rows:card().rows,n:20,nOther:25,days:8,daysOther:9,unit:'sessions'}}
  const before=JSON.stringify(source),shown=displayOrigin(source,schema,'de')
  expect(shown.title).toContain(translate('de','Bedroom'))
  expect(shown.calculation).toContain('20');expect(shown.calculation).toContain('25')
  expect(shown.contexts).toBe(source.contexts);expect(shown.comparison).toBe(source.comparison)
  expect(JSON.stringify(source)).toBe(before)
})
it('translates every approved theme structure while retaining its palette identity',()=>{
  for(const {id:language} of LANGUAGES.filter(l=>l.id!=='en'))for(const theme of APPROVED_COLOURS){
    const before=JSON.stringify(theme),name=localizedThemeName(language,theme.name)
    expect(name).not.toMatch(/White|Night|\bink\b|\bpale\b|\bdeep\b|reference/)
    expect(name).not.toMatch(/\{[A-Za-z]+\}/)
    expect(JSON.stringify(theme)).toBe(before)
  }
  expect(localizedThemeName('en','White / Crimson')).toBe('White / Crimson')
})
