// Exercise visible destinations in the same two-level navigation a user sees.
const labels={insights:'Your insights',weekly:'Your week',overview:'Overview',subjects:'Subjects',factors:'Recorded comparisons',setup:'Setup comparisons',time:'Time patterns',rhythm:'Study rhythm',distractions:'Distractions',rest:'Rest',methods:'Methods',stage:'Study-time milestones',modes:'Timer modes',report:'Report'};
module.exports=async(page,text,id)=>{
 const group=id==='insights'?'Your insights':id==='report'?'Report':['weekly','overview','subjects','rhythm','stage'].includes(id)?'Activity':'Comparisons';
 await page.getByRole('navigation',{name:text('Stats sections'),exact:true}).getByRole('button',{name:text(group),exact:true}).click();
 if(!['insights','report'].includes(id))await page.getByRole('navigation',{name:text('Go to Stats section'),exact:true}).getByRole('button',{name:text(labels[id]),exact:true}).click();
};
