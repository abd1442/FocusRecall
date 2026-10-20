import { EMPTY_TOOLS, validateView, validateExperiment, validateReview, type StudyToolsData, type ComparisonView, type StudyExperiment, type WeeklyReflection } from '@core/studyTools'
import type { SettingsRepo } from './settings'
import { validateDiscovery, type DiscoveryRecord } from '@core/discoveries'

/** Each mutation reads the current value; it never overwrites another window's unrelated entry. */
export class StudyToolsRepo {
  constructor(private settings:SettingsRepo){}
  get():StudyToolsData {return (this.settings.readRaw('studyTools') as StudyToolsData|null)??structuredClone(EMPTY_TOOLS)}
  private write(data:StudyToolsData):StudyToolsData {this.settings.writeRaw('studyTools',data);return data}
  saveView(view:ComparisonView):StudyToolsData {validateView(view);const d=this.get();if(d.views.length>=100&&!d.views.some(x=>x.id===view.id))throw Error('You can save up to 100 views.');d.views=[...d.views.filter(x=>x.id!==view.id),view];return this.write(d)}
  saveExperiment(e:StudyExperiment):StudyToolsData {validateExperiment(e);const d=this.get();if(d.experiments.length>=200&&!d.experiments.some(x=>x.id===e.id))throw Error('You can save up to 200 experiments.');d.experiments=[...d.experiments.filter(x=>x.id!==e.id),e];return this.write(d)}
  saveReview(r:WeeklyReflection):StudyToolsData {validateReview(r);const d=this.get();d.reviews=[...d.reviews.filter(x=>x.week!==r.week),r];return this.write(d)}
  saveDiscovery(entry:DiscoveryRecord):StudyToolsData {validateDiscovery(entry);const d=this.get(),entries=d.discoveries??[];if(entries.length>=300&&!entries.some(x=>x.key===entry.key))throw Error('Your playbook has reached 300 reviewed findings. Existing entries can still be updated.');d.discoveries=[...entries.filter(x=>x.key!==entry.key),entry];return this.write(d)}
  remove(kind:'view'|'experiment',id:string):StudyToolsData {if(!['view','experiment'].includes(kind))throw Error('Invalid tool.');const d=this.get();if(kind==='view')d.views=d.views.filter(x=>x.id!==id);else d.experiments=d.experiments.filter(x=>x.id!==id);return this.write(d)}
}
