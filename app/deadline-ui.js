let duePanelError=false,urgentExpanded=false,urgentHighlightTimer;
function renderUrgentHomework(){
 const panel=$('#urgent-homework');
 if(!loaded){panel.className='urgent-panel neutral';panel.innerHTML='<div class="urgent-heading">'+svg('clock')+'<h2 id="urgent-title">마감 임박 숙제</h2></div><p class="urgent-empty">'+(duePanelError?'마감일을 불러오지 못했어요. 로그인·연결 상태를 확인해 주세요.':'숙제 마감일을 확인하고 있어요…')+'</p>';return;}
 const summary=getDeadlineSummary(state.tasks,todayISO()),count=summary.urgent.length;
 panel.className='urgent-panel '+(count?'has-urgent':'clear');
 const visible=urgentExpanded?summary.urgent:summary.urgent.slice(0,4);
 const row=item=>{const t=item.task;const label=item.daysLeft<0?'마감 '+Math.abs(item.daysLeft)+'일 지남':item.daysLeft===0?'오늘까지':'내일까지';return '<button type="button" class="urgent-item '+item.kind+'" data-urgent-task="'+escapeHTML(t.id)+'"><span class="urgent-deadline '+item.kind+'">'+label+'</span><span class="urgent-item-text"><strong>'+escapeHTML(t.title)+'</strong><small>'+escapeHTML(t.subject)+' · '+dateLabel(t.due_date)+' 마감</small></span><span class="urgent-arrow" aria-hidden="true">›</span></button>';};
 panel.innerHTML='<div class="urgent-header"><div class="urgent-heading">'+svg(count?'clock':'check')+'<h2 id="urgent-title">'+(count?'마감 임박 숙제':'지금 급한 숙제는 없어요')+'</h2>'+(count?'<span class="urgent-total" aria-live="polite">'+count+'개</span>':'')+'</div><span class="urgent-range">오늘·내일까지 · 한국 시간 기준</span></div>'+(count?'<div class="urgent-counts"><span class="overdue">마감 지남 <b>'+summary.counts.overdue+'</b></span><span class="today">오늘 마감 <b>'+summary.counts.today+'</b></span><span class="tomorrow">내일 마감 <b>'+summary.counts.tomorrow+'</b></span></div><div class="urgent-list">'+visible.map(row).join('')+'</div>'+(count>4?'<button type="button" class="urgent-expand" id="urgent-expand" aria-expanded="'+urgentExpanded+'">'+(urgentExpanded?'접기':'임박한 숙제 '+count+'개 모두 보기')+'</button>':''):'<p class="urgent-empty">오늘·내일까지 해야 할 숙제가 없어요.</p>')+(summary.waiting.length?'<div class="urgent-waiting"><span>학생이 끝낸 임박 숙제 중 <b>엄마 확인 대기 '+summary.waiting.length+'개</b></span><button type="button" id="urgent-review">확인 대기 보기 →</button></div>':'')+(duePanelError?'<p class="urgent-stale">연결을 확인 중이에요. 마지막으로 불러온 기록을 표시하고 있어요.</p>':'');
}
function applyHomeworkFilters(nextFilter='all'){
 filter=nextFilter;subjectFilter='all';$('#subject-filter').value='all';
 $$('[data-filter]').forEach(button=>{const active=button.dataset.filter===nextFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 renderTasks();
}
function jumpToHomework(id){
 if(!state.tasks.some(t=>t.id===id)){toast('숙제 목록이 바뀌었어요. 새로 불러온 뒤 확인해 주세요.');return;}
 applyHomeworkFilters();const target=$$('[data-task]').find(node=>node.dataset.task===id);if(!target)return;
 const behavior=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth';
 target.scrollIntoView({behavior,block:'center'});target.focus({preventScroll:true});target.classList.add('deadline-focus');clearTimeout(urgentHighlightTimer);urgentHighlightTimer=setTimeout(()=>target.classList.remove('deadline-focus'),2200);
}
$('#urgent-homework').addEventListener('click',event=>{
 const item=event.target.closest('[data-urgent-task]');if(item){jumpToHomework(item.dataset.urgentTask);return;}
 if(event.target.closest('#urgent-expand')){urgentExpanded=!urgentExpanded;renderUrgentHomework();return;}
 if(event.target.closest('#urgent-review')){applyHomeworkFilters('wait');$('#homework-section').scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});}
});
