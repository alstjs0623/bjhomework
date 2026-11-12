const accessError=(message,status)=>{throw Object.assign(new Error(message),{status});};
export function requestUser(request,env={}){
 const id=request.headers.get('oai-authenticated-user-id')?.trim();
 const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
 if(!id||!email)accessError('로그인 계정을 확인할 수 없어요. ChatGPT 계정으로 다시 로그인해 주세요.',401);
 const momEmail=String(env.MOM_EMAIL||'').trim().toLowerCase();
 const studentEmail=String(env.STUDENT_EMAIL||'').trim().toLowerCase();
 if(!momEmail||!studentEmail||momEmail===studentEmail)accessError('로그인 권한 설정이 필요합니다. 서버의 MOM_EMAIL과 STUDENT_EMAIL을 확인해 주세요.',503);
 const role=email===momEmail?'mom':email===studentEmail?'student':'viewer';
 const permissions={canManage:role==='mom',canCreate:role!=='viewer',canStudentCheck:role!=='viewer',canMomConfirm:role==='mom',canPractice:role!=='viewer'};
 return{id,email,role,permissions};
}
export function requireManage(user){if(!user.permissions.canManage)accessError('수정·삭제와 엄마 확인은 설정된 엄마 계정으로만 할 수 있어요.',403);}
export function requireCreate(user){if(!user.permissions.canCreate)accessError('숙제·사진 등록은 엄마 또는 병준이 계정으로만 할 수 있어요.',403);}
export function requirePractice(user){if(!user.permissions.canPractice)accessError('완료 체크와 예습시험은 엄마 또는 병준이 계정으로만 할 수 있어요.',403);}
