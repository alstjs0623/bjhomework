import {requestUser,requireManage,requireCreate,requirePractice} from './auth.js';
import {handlePhoto,handleVocabulary,vocabularyList} from './vocabulary.js';
export const SUBJECTS = ['수학', '영어', '생명과학', '논술', '수영'];
export const DEFAULT_SCHEDULE = [
 {id:'mon-math',day:1,start:'14:00',end:'15:30',subject:'수학'},
 {id:'mon-english',day:1,start:'16:00',end:'17:00',subject:'영어'},
 {id:'tue-science',day:2,start:'15:00',end:'16:30',subject:'생명과학'},
 {id:'tue-english',day:2,start:'17:00',end:'18:00',subject:'영어'},
 {id:'wed-math',day:3,start:'14:00',end:'15:30',subject:'수학'},
 {id:'wed-english',day:3,start:'16:00',end:'17:00',subject:'영어'},
 {id:'wed-writing',day:3,start:'17:10',end:'18:20',subject:'논술'},
 {id:'wed-swim',day:3,start:'19:00',end:'20:00',subject:'수영'},
 {id:'thu-english',day:4,start:'16:00',end:'17:00',subject:'영어'},
 {id:'fri-math',day:5,start:'14:00',end:'15:30',subject:'수학'},
 {id:'fri-english',day:5,start:'16:00',end:'17:00',subject:'영어'},
 {id:'fri-swim',day:5,start:'19:00',end:'20:00',subject:'수영'}
];
export const json = (data, status=200) => Response.json(data, {status,headers:{'cache-control':'no-store'}});
export const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
export const validDate = value => {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value>='2020-01-01'&&value<='2100-12-31';
};
export function validateHomework(input) {
 if(!SUBJECTS.includes(input.subject))fail('과목을 선택해 주세요.');
 if(typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>100)fail('숙제 제목을 100자 이내로 입력해 주세요.');
 if(typeof input.body!=='string'||input.body.length>5000)fail('숙제 내용은 5,000자 이내로 작성해 주세요.');
 if(!validDate(input.due_date))fail('올바른 마감일을 선택해 주세요.');
 return {subject:input.subject,title:input.title.trim(),body:input.body.trim(),due_date:input.due_date};
}
export function validateSchedule(items) {
 if(!Array.isArray(items)||items.length>60)fail('시간표는 최대 60개 수업까지 저장할 수 있어요.');
 const ids=new Set();
 return items.map(item=>{
  if(!item||!SUBJECTS.includes(item.subject)||!Number.isInteger(item.day)||item.day<1||item.day>7)fail('요일과 과목을 확인해 주세요.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end)||item.start>=item.end)fail('수업 종료 시간은 시작 시간보다 늦어야 해요.');
  if(typeof item.id!=='string'||!item.id||item.id.length>80||ids.has(item.id))fail('수업 정보가 올바르지 않아요.');
  ids.add(item.id);
  return {id:item.id,day:item.day,start:item.start,end:item.end,subject:item.subject};
 }).sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start));
}
export function transition(row,input) {
 const next={student_done:row.student_done,mom_done:row.mom_done};
 if(input.action==='student') {
  if(typeof input.done!=='boolean')fail('완료 여부를 확인해 주세요.');
  next.student_done=Number(input.done); if(!input.done)next.mom_done=0;
 } else if(input.action==='mom') {
  if(typeof input.done!=='boolean')fail('확인 여부를 확인해 주세요.');
  if(input.done&&!row.student_done)fail('학생이 숙제를 완료한 뒤 엄마가 확인할 수 있어요.');
  next.mom_done=Number(input.done);
 } else fail('지원하지 않는 작업이에요.');
 return next;
}
export async function handleAPI(request,env) {
 try {
  const user=requestUser(request,env);
  if(!env.DB)fail('공유 저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',503);
  const url=new URL(request.url),path=url.pathname;
  if(!['GET','HEAD'].includes(request.method)) {
   if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)fail('같은 페이지에서 다시 시도해 주세요.',403);
   if(path.startsWith('/api/vocab/photos'))return await handlePhoto(request,env,user);
   if(!request.headers.get('content-type')?.includes('application/json'))fail('올바르지 않은 요청이에요.',415);
   if(Number(request.headers.get('content-length')||0)>(path.startsWith('/api/vocab')?100000:25000))fail('입력 내용이 너무 길어요.',413);
  }
  if(path.startsWith('/api/vocab/photos')&&request.method==='GET')return await handlePhoto(request,env,user);
  const bodyLimit=path.startsWith('/api/vocab')?100000:25000;
  let input;
  if(!['GET','HEAD'].includes(request.method)) {
   const raw=await request.text();if(raw.length>bodyLimit)fail('입력 내용이 너무 길어요.',413);
   try{input=JSON.parse(raw);}catch{fail('입력 내용을 확인해 주세요.');}
   if(!input||typeof input!=='object'||Array.isArray(input))fail('입력 내용을 확인해 주세요.');
  }
  if(path.startsWith('/api/vocab'))return await handleVocabulary(request,env,input,user);
  if(path==='/api/state'&&request.method==='GET') {
   const [tasks,setting,vocabulary]=await Promise.all([
    env.DB.prepare('SELECT * FROM homework ORDER BY due_date ASC, created_at DESC').all(),
    env.DB.prepare("SELECT value, version FROM settings WHERE key = 'schedule'").first(),
    vocabularyList(env)
   ]);
   return json({user:{email:user.email,role:user.role},permissions:user.permissions,vocabulary,tasks:tasks.results,schedule:setting?JSON.parse(setting.value):DEFAULT_SCHEDULE,scheduleVersion:setting?.version||0,serverTime:new Date().toISOString()});
  }
  if(path==='/api/homework'&&request.method==='POST') {
   requireCreate(user);
   const data=validateHomework(input),id=crypto.randomUUID(),now=new Date().toISOString();
   await env.DB.prepare('INSERT INTO homework (id,subject,title,body,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,data.subject,data.title,data.body,data.due_date,now,now).run();
   return json({id},201);
  }
  const match=path.match(/^\/api\/homework\/([a-zA-Z0-9-]{1,80})$/);
  if(match&&['PATCH','DELETE'].includes(request.method)) {
   if(request.method==='DELETE'||input.action==='edit'||input.action==='mom')requireManage(user);
   else if(input.action==='student')requirePractice(user);
   else requireManage(user);
   const id=match[1];
   if(!Number.isInteger(input.version)||input.version<1)fail('최신 기록을 불러온 뒤 다시 시도해 주세요.',409);
   const row=await env.DB.prepare('SELECT * FROM homework WHERE id = ?').bind(id).first();
   if(!row)fail('이미 삭제된 숙제예요. 목록을 새로 불러와 주세요.',404);
   if(row.version!==input.version)fail('다른 기기에서 변경한 숙제예요. 최신 내용을 확인하고 다시 시도해 주세요.',409);
   let result;
   if(request.method==='DELETE')result=await env.DB.prepare('DELETE FROM homework WHERE id = ? AND version = ?').bind(id,input.version).run();
   else if(input.action==='edit') {
    const d=validateHomework(input);
    result=await env.DB.prepare('UPDATE homework SET subject=?,title=?,body=?,due_date=?,student_done=0,mom_done=0,version=version+1,updated_at=? WHERE id=? AND version=?').bind(d.subject,d.title,d.body,d.due_date,new Date().toISOString(),id,input.version).run();
   }else{
    const d=transition(row,input);
    result=await env.DB.prepare('UPDATE homework SET student_done=?,mom_done=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(d.student_done,d.mom_done,new Date().toISOString(),id,input.version).run();
   }
   if(result.meta.changes!==1)fail('다른 기기에서 변경했어요. 최신 내용을 확인하고 다시 시도해 주세요.',409);
   return json({ok:true});
  }
  if(path==='/api/schedule'&&request.method==='PUT') {
   requireManage(user);
   const items=validateSchedule(input.schedule);
   if(!Number.isInteger(input.version)||input.version<0)fail('시간표를 새로 불러와 주세요.',409);
   let result;
   if(input.version===0)result=await env.DB.prepare("INSERT INTO settings (key,value,version) VALUES ('schedule',?,1) ON CONFLICT(key) DO NOTHING").bind(JSON.stringify(items)).run();
   else result=await env.DB.prepare("UPDATE settings SET value=?,version=version+1 WHERE key='schedule' AND version=?").bind(JSON.stringify(items),input.version).run();
   if(result.meta.changes!==1)fail('다른 기기에서 시간표를 변경했어요. 최신 시간표를 확인해 주세요.',409);
   return json({ok:true});
  }
  return json({error:'요청한 기능을 찾을 수 없어요.'},404);
 }catch(error){
  if(!error.status)console.error('homework_api_failure',error.message);
  return json({error:error.status?error.message:'저장소에서 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'},error.status||500);
 }
}
