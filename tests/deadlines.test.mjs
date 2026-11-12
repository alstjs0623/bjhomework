import test from 'node:test';
import assert from 'node:assert/strict';
import {getDeadlineSummary} from '../app/deadlines.js';
const task=(id,due_date,student_done=0,mom_done=0)=>({id,due_date,student_done,mom_done,subject:'수학',title:id});
test('overdue, today, and tomorrow homework is prioritized, while finished work and later deadlines are excluded',()=>{
 const items=[task('later','2026-11-14'),task('tomorrow','2026-11-13'),task('today','2026-11-12'),task('overdue','2026-11-10'),task('waiting','2026-11-11',1),task('done','2026-11-09',1,1)];
 const summary=getDeadlineSummary(items,'2026-11-12');
 assert.deepEqual(summary.urgent.map(i=>i.task.id),['overdue','today','tomorrow']);
 assert.deepEqual(summary.counts,{overdue:1,today:1,tomorrow:1});
 assert.deepEqual(summary.waiting.map(i=>i.task.id),['waiting']);
 assert.equal(summary.urgent[0].daysLeft,-2);
});
test('the next calendar day updates tomorrow to today and today to overdue',()=>{
 const items=[task('first','2026-11-12'),task('second','2026-11-13')];
 assert.deepEqual(getDeadlineSummary(items,'2026-11-12').urgent.map(i=>i.kind),['today','tomorrow']);
 assert.deepEqual(getDeadlineSummary(items,'2026-11-13').urgent.map(i=>i.kind),['overdue','today']);
});
test('calendar boundaries work across months, leap days, and years',()=>{
 assert.equal(getDeadlineSummary([task('next-year','2027-01-01')],'2026-12-31').urgent[0].kind,'tomorrow');
 assert.equal(getDeadlineSummary([task('leap-day','2028-02-29')],'2028-03-01').urgent[0].daysLeft,-1);
 assert.equal(getDeadlineSummary([task('next-month','2026-12-01')],'2026-11-30').urgent[0].kind,'tomorrow');
});
test('invalid dates do not create false warnings and completed tasks never appear as urgent',()=>{
 const summary=getDeadlineSummary([task('bad','2026-02-30'),task('missing',null),task('done','2026-11-01',1,1)],'2026-11-12');
 assert.equal(summary.urgent.length,0);assert.equal(summary.waiting.length,0);
 assert.equal(getDeadlineSummary([task('good','2026-11-12')],'invalid').urgent.length,0);
});
