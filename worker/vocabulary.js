import {requireManage,requireCreate,requirePractice} from './auth.js';
import {json,fail,validDate} from './api.js';
export function validateVocabulary(input) {
 if(typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>100)fail('시험 이름을 100자 이내로 입력해 주세요.');
 if(!validDate(input.test_date)||![3,5].includes(new Date(input.test_date+'T12:00:00Z').getUTCDay()))fail('단어시험 날짜는 수요일 또는 금요일로 선택해 주세요.');
 if(![80,90,100].includes(input.pass_score))fail('통과 기준은 80점, 90점, 100점 중 선택해 주세요.');
 if(!Array.isArray(input.words)||input.words.length>200)fail('단어 목록을 확인해 주세요.');
 if(input.words.length===0&&!input.photo_id)fail('저장할 단어 사진을 선택해 주세요.');
 const words=input.words.map(word=>{
  if(!word||typeof word.english!=='string'||!/[a-z]/i.test(word.english)||word.english.length>120||/[^a-zA-Z\s'’.,!?()\/;\-]/.test(word.english))fail('영어 칸에는 영단어를 입력해 주세요. 다른 정답은 /로 구분할 수 있어요.');
  if(typeof word.meaning!=='string'||!word.meaning.trim()||word.meaning.length>300)fail('모든 단어의 뜻을 300자 이내로 입력해 주세요.');
  if(word.english.split(/[\/;]/).some(a=>!/[a-z]/i.test(a)))fail('다른 정답을 /로 구분할 때 빈 정답을 남기지 마세요.');
  return {english:word.english.trim(),meaning:word.meaning.trim()};
 });
 if(input.photo_id!==null&&input.photo_id!==undefined&&(typeof input.photo_id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(input.photo_id)))fail('사진 정보를 확인해 주세요.');
 return {title:input.title.trim(),test_date:input.test_date,pass_score:input.pass_score,words,photo_id:input.photo_id||null};
}
export function normalizeAnswer(value){return value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ');}
export function gradeVocabulary(words,answers,threshold){
 if(!Array.isArray(answers)||answers.length!==words.length||answers.some(a=>typeof a!=='string'||a.length>200))fail('모든 문제의 답안을 확인해 주세요.');
 let correct=0;
 const results=words.map((w,i)=>{const matched=w.english.split(/[\/;]/).some(a=>normalizeAnswer(a)===normalizeAnswer(answers[i]));if(matched)correct++;return {meaning:w.meaning,expected:w.english,answer:answers[i],correct:matched};});
 return {correct,total:words.length,score:Math.round(correct/words.length*1000)/10,passed:correct*100>=threshold*words.length,pass_score:threshold,results};
}
function shuffleWords(words){const out=words.slice();for(let i=out.length-1;i>0;i--){const r=new Uint32Array(1);crypto.getRandomValues(r);const j=r[0]%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
async function checkPhoto(env,id){if(id&&!await env.DB.prepare('SELECT id FROM vocab_photos WHERE id=?').bind(id).first())fail('사진을 다시 올려 주세요.');}
export async function handlePhoto(request,env,user){
 if(request.method==='POST')requireCreate(user);
 if(request.method==='DELETE')requireCreate(user);
 if(!env.BUCKET)fail('사진 저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',503);
 const url=new URL(request.url),id=url.pathname.split('/')[4];
 if(request.method==='POST'&&url.pathname==='/api/vocab/photos'){
  if(Number(request.headers.get('content-length')||0)>8*1024*1024)fail('사진은 8MB 이하로 올려 주세요.',413);
  const reader=request.body?.getReader();if(!reader)fail('사진을 선택해 주세요.');
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();fail('사진은 8MB 이하로 올려 주세요.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let contentType='';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)contentType='image/jpeg';
  else if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')contentType='image/png';
  else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')contentType='image/webp';
  if(!contentType)fail('JPG, PNG 또는 WEBP 사진을 선택해 주세요.');
  const photoId=crypto.randomUUID(),key='vocabulary/'+photoId;
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType}});
  try{await env.DB.prepare('INSERT INTO vocab_photos (id,object_key,content_type,created_at,uploader_id) VALUES (?,?,?,?,?)').bind(photoId,key,contentType,new Date().toISOString(),user.id).run();}catch(error){await env.BUCKET.delete(key);throw error;}
  return json({id:photoId,url:'/api/vocab/photos/'+photoId},201);
 }
 if(!id||!/^[-a-zA-Z0-9]{1,80}$/.test(id))fail('사진을 찾을 수 없어요.',404);
 const photo=await env.DB.prepare('SELECT * FROM vocab_photos WHERE id=?').bind(id).first();if(!photo)fail('사진을 찾을 수 없어요.',404);
 if(request.method==='GET'){
  const object=await env.BUCKET.get(photo.object_key);if(!object)fail('저장된 사진을 불러오지 못했어요.',404);
  return new Response(object.body,{headers:{'content-type':photo.content_type,'cache-control':'private, max-age=300','x-content-type-options':'nosniff'}});
 }
 if(request.method==='DELETE'){
  if(!user.permissions.canManage&&photo.uploader_id!==user.id)requireManage(user);
  if(await env.DB.prepare('SELECT id FROM vocab_sets WHERE photo_id=?').bind(id).first())fail('시험에 등록된 사진은 시험을 수정한 뒤 삭제해 주세요.',409);
  await env.BUCKET.delete(photo.object_key);await env.DB.prepare('DELETE FROM vocab_photos WHERE id=?').bind(id).run();return json({ok:true});
 }
 fail('지원하지 않는 사진 요청이에요.',405);
}
export async function vocabularyList(env){
 const rows=await env.DB.prepare(`SELECT s.id,s.title,s.test_date,s.photo_id,s.pass_score,s.version,s.updated_at,s.manual_passed_at,json_array_length(s.words) AS word_count,
 CASE WHEN json_array_length(s.words)=0 THEN 1 ELSE 0 END AS photo_only,
 (SELECT MAX(a.score) FROM vocab_attempts a WHERE a.set_id=s.id AND a.set_version=s.version AND a.completed_at IS NOT NULL) AS best_score,
 (SELECT COUNT(*) FROM vocab_attempts a WHERE a.set_id=s.id AND a.set_version=s.version AND a.completed_at IS NOT NULL) AS attempt_count,
 CASE WHEN json_array_length(s.words)=0 THEN s.manual_passed ELSE COALESCE((SELECT MAX(a.passed) FROM vocab_attempts a WHERE a.set_id=s.id AND a.set_version=s.version AND a.completed_at IS NOT NULL),0) END AS passed
 FROM vocab_sets s ORDER BY s.test_date DESC,s.created_at DESC`).all();return rows.results;
}
export async function handleVocabulary(request,env,input,user){
 const path=new URL(request.url).pathname,method=request.method;
 if(path==='/api/vocab'&&method==='GET')return json({sets:await vocabularyList(env)});
 if(path==='/api/vocab'&&method==='POST'){
  requireCreate(user);
  const d=validateVocabulary(input);await checkPhoto(env,d.photo_id);const id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare('INSERT INTO vocab_sets (id,title,test_date,words,pass_score,photo_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,d.title,d.test_date,JSON.stringify(d.words),d.pass_score,d.photo_id,now,now).run();
  return json({id},201);
 }
 const submission=path.match(/^\/api\/vocab\/attempts\/([-a-zA-Z0-9]{1,80})\/submit$/);
 if(submission&&method==='POST'){
  requirePractice(user);
  const row=await env.DB.prepare('SELECT a.*,s.version AS current_version,s.pass_score FROM vocab_attempts a JOIN vocab_sets s ON s.id=a.set_id WHERE a.id=?').bind(submission[1]).first();
  if(!row)fail('시험 기록을 찾지 못했어요. 다시 시험을 시작해 주세요.',404);
  if(row.set_version!==row.current_version)fail('단어 목록이 바뀌었어요. 최신 목록으로 시험을 다시 시작해 주세요.',409);
  if(row.completed_at)return json(JSON.parse(row.results));
  const result=gradeVocabulary(JSON.parse(row.questions),input.answers,row.pass_score);
  const update=await env.DB.prepare('UPDATE vocab_attempts SET results=?,score=?,passed=?,completed_at=? WHERE id=? AND completed_at IS NULL AND EXISTS (SELECT 1 FROM vocab_sets s WHERE s.id=vocab_attempts.set_id AND s.version=vocab_attempts.set_version)').bind(JSON.stringify(result),result.score,Number(result.passed),new Date().toISOString(),row.id).run();
  if(update.meta.changes!==1){const saved=await env.DB.prepare('SELECT results FROM vocab_attempts WHERE id=? AND completed_at IS NOT NULL').bind(row.id).first();if(saved)return json(JSON.parse(saved.results));fail('단어 목록이 바뀌었어요. 시험을 다시 시작해 주세요.',409);}
  return json(result);
 }
 const start=path.match(/^\/api\/vocab\/([-a-zA-Z0-9]{1,80})\/start$/);
 if(start&&method==='POST'){
  requirePractice(user);
  const set=await env.DB.prepare('SELECT * FROM vocab_sets WHERE id=?').bind(start[1]).first();if(!set)fail('시험 목록을 찾지 못했어요.',404);
  if(set.version!==input.version)fail('단어 목록이 바뀌었어요. 새로 불러와 주세요.',409);
  if(JSON.parse(set.words).length===0)fail('사진을 보며 예습한 뒤 통과 여부를 직접 체크해 주세요.');
  const questions=shuffleWords(JSON.parse(set.words)),id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO vocab_attempts (id,set_id,set_version,questions,created_at) VALUES (?,?,?,?,?)').bind(id,set.id,set.version,JSON.stringify(questions),new Date().toISOString()).run();
  return json({id,title:set.title,test_date:set.test_date,pass_score:set.pass_score,questions:questions.map(q=>({meaning:q.meaning}))},201);
 }
 const match=path.match(/^\/api\/vocab\/([-a-zA-Z0-9]{1,80})$/);
 if(match){const id=match[1],set=await env.DB.prepare('SELECT * FROM vocab_sets WHERE id=?').bind(id).first();if(!set)fail('시험 목록을 찾지 못했어요.',404);
  if(method==='GET'){
   const attempts=await env.DB.prepare('SELECT score,passed,completed_at FROM vocab_attempts WHERE set_id=? AND set_version=? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 10').bind(id,set.version).all();
   return json({...set,words:JSON.parse(set.words),attempts:attempts.results});
  }
  if(['PATCH','DELETE'].includes(method)){
   if(method==='PATCH'&&input.action==='mark_pass')requirePractice(user);else requireManage(user);
   if(input.version!==set.version)fail('다른 기기에서 시험을 바꿨어요. 최신 목록을 다시 열어 주세요.',409);
   let result;
   if(method==='DELETE')result=await env.DB.prepare('DELETE FROM vocab_sets WHERE id=? AND version=?').bind(id,input.version).run();
   else if(input.action==='mark_pass'){
    if(JSON.parse(set.words).length!==0)fail('기존 단어 목록 시험은 채점 결과로 통과를 확인해 주세요.');
    if(typeof input.done!=='boolean')fail('통과 여부를 확인해 주세요.');
    result=await env.DB.prepare('UPDATE vocab_sets SET manual_passed=?,manual_passed_at=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(Number(input.done),input.done?new Date().toISOString():null,new Date().toISOString(),id,input.version).run();
   }else{const d=validateVocabulary(input);await checkPhoto(env,d.photo_id);result=await env.DB.prepare('UPDATE vocab_sets SET title=?,test_date=?,words=?,pass_score=?,photo_id=?,manual_passed=0,manual_passed_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=?').bind(d.title,d.test_date,JSON.stringify(d.words),d.pass_score,d.photo_id,new Date().toISOString(),id,input.version).run();}
   if(result.meta.changes<1)fail('다른 기기에서 시험을 바꿨어요. 최신 목록을 확인해 주세요.',409);
   return json({ok:true});
  }
 }
 fail('시험 기능을 찾을 수 없어요.',404);
}
