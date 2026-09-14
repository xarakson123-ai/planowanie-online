/* v12 reward feedback: visible coin changes and lightweight notifications */
(function(){
  const S=window.PLANOWANIE_SERVER||'https://planowanie-server.onrender.com';
  const token=()=>localStorage.getItem('planowanieAuthToken')||'';
  let last=null;
  function toast(t){if(window.PlanowanieV12?.toast)return window.PlanowanieV12.toast(t);const x=document.createElement('div');x.textContent=t;x.style='position:fixed;right:24px;bottom:24px;z-index:15000;padding:14px 18px;border:1px solid #c59a36;border-radius:12px;background:#101b25;color:#fff;font-weight:700';document.body.appendChild(x);setTimeout(()=>x.remove(),4000)}
  async function poll(){const t=token();if(!t)return;try{const r=await fetch(S+'/api/me',{headers:{Authorization:'Bearer '+t}});const d=await r.json();const c=Number(d.user?.coins);if(!Number.isFinite(c))return;if(last!==null&&c!==last){const diff=c-last;toast((diff>0?'💰 Otrzymano +':'💸 Wydano ')+Math.abs(diff)+' coins');}last=c}catch{}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',poll);else poll();setInterval(poll,4000);
})();
