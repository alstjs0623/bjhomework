const calendarDay=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const stamp=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:null;
};
export function getDeadlineSummary(tasks,today){
 const todayDay=calendarDay(today),urgent=[],waiting=[],counts={overdue:0,today:0,tomorrow:0};
 if(todayDay===null)return{urgent,waiting,counts};
 for(const task of tasks){
  if(task.mom_done)continue;
  const dueDay=calendarDay(task.due_date);if(dueDay===null)continue;
  const daysLeft=Math.round((dueDay-todayDay)/86400000);if(daysLeft>1)continue;
  const item={task,daysLeft,kind:daysLeft<0?'overdue':daysLeft===0?'today':'tomorrow'};
  if(task.student_done)waiting.push(item);
  else{urgent.push(item);counts[item.kind]++;}
 }
 const byDeadline=(a,b)=>a.task.due_date.localeCompare(b.task.due_date)||String(a.task.created_at||'').localeCompare(String(b.task.created_at||''))||String(a.task.id).localeCompare(String(b.task.id));
 urgent.sort(byDeadline);waiting.sort(byDeadline);
 return{urgent,waiting,counts};
}
