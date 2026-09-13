(function(){
  async function boot(){
    try{if(window.PlanowanieSocial?.api){const me=await window.PlanowanieSocial.api('/api/me');window.__planowanieMyAccountId=me.user.id}}catch{}
    document.addEventListener('click',function(e){
      const b=e.target.closest&&e.target.closest('.equip');
      if(!b)return;
      setTimeout(()=>{const s=window.planowanieSocket,code=localStorage.getItem('planowanieRoom'),t=localStorage.getItem('planowaniePlayerToken');if(s&&code&&t)s.emit('resume',{code,token:t})},500);
    },true);
    document.addEventListener('click',async function(e){
      const b=e.target.closest&&e.target.closest('.chatFriend');
      if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      const api=window.PlanowanieSocial?.api;if(!api)return;
      const id=Number(b.dataset.id),name=b.dataset.name||'Znajomy';
      try{
        const d=await api('/api/messages');
        const msgs=(d.messages||[]).filter(m=>Number(m.from_user)===id||Number(m.to_user)===id);
        const body=document.getElementById('socialBody');if(!body)return;
        const me=Number(window.__planowanieMyAccountId);
        const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
        body.innerHTML=`<h3>Rozmowa z ${esc(name)}</h3><div class="chatBox" id="chatFixBox">${msgs.length?msgs.map(m=>`<div class="chatLine ${Number(m.from_user)===me?'mine':''}"><div class="chatMeta">${esc(m.from_username||'Gracz')}</div>${esc(m.body)}${m.kind==='invite'?`<div class="inviteBox"><b>🎴 Zaproszenie do pokoju</b><br><button class="btn joinInviteFix" data-code="${esc(m.room_code||'')}">Dołącz do pokoju</button></div>`:''}</div>`).join(''):'<div class="socialMuted">Brak wiadomości.</div>'}</div><div class="socialSearch"><input id="chatFixText" maxlength="500" placeholder="Napisz wiadomość…"><button class="btn" id="chatFixSend">Wyślij</button></div>`;
        const send=async()=>{const input=document.getElementById('chatFixText');if(!input||!input.value.trim())return;await api('/api/messages',{method:'POST',body:JSON.stringify({toUserId:id,body:input.value.trim()})});input.value='';b.click()};
        document.getElementById('chatFixSend').onclick=()=>send().catch(x=>alert(x.message));
        document.getElementById('chatFixText').addEventListener('keydown',x=>{if(x.key==='Enter')send().catch(y=>alert(y.message))});
        document.querySelectorAll('.joinInviteFix').forEach(x=>x.onclick=()=>{const code=x.dataset.code;const input=document.getElementById('code');if(input)input.value=code;document.querySelector('.socialModal')?.classList.add('hidden');document.getElementById('join')?.click()});
        const box=document.getElementById('chatFixBox');if(box)box.scrollTop=box.scrollHeight;
      }catch(x){alert(x.message||x)}
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
