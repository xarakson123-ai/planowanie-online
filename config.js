window.PLANOWANIE_SERVER='https://planowanie-server.onrender.com';
/* Klient Socket.IO jest ładowany z Render jako awaryjne źródło, gdyby CDN nie zadziałał. */
if(typeof window.io!=='function'){
  document.write('<script src="https://planowanie-server.onrender.com/socket.io/socket.io.js"><\/script>');
}
(function(){
  const realIO=window.io;
  if(typeof realIO==='function'){
    window.io=function(url,opts){
      const s=realIO(url,{...(opts||{}),transports:['polling'],upgrade:false,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:1000,reconnectionDelayMax:5000,timeout:12000});
      window.planowanieSocket=s;
      s.on('connect',()=>{window.__planowanieConnected=true;window.__planowanieSocketError='';});
      s.on('connect_error',e=>{window.__planowanieConnected=false;window.__planowanieSocketError=e&&e.message?e.message:String(e||'Błąd połączenia');console.error('Planowanie Socket.IO:',e);});
      s.on('disconnect',()=>{window.__planowanieConnected=false;});
      return s;
    };
  }else{
    window.__planowanieSocketError='Nie załadował się klient Socket.IO.';
  }
})();
(function(){
const S=window.PLANOWANIE_SERVER,K='planowanieAuthToken',A=['😀','😎','🤠','🥶','😈','👑','🦊','🐺','🐼','🐸','🤖','👽','🎩','🃏','♠️','🔥'];let u=null,sel='😀';
const $=x=>document.getElementById(x),tok=()=>localStorage.getItem(K)||'';
async function api(p,o={}){let h={'Content-Type':'application/json',...(o.headers||{})},t=tok();if(t)h.Authorization='Bearer '+t;let r=await fetch(S+p,{...o,headers:h}),d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Błąd serwera.');return d}
function css(){let s=document.createElement('style');s.textContent='.accbar{display:flex;justify-content:flex-end;gap:8px;align-items:center;margin:-4px 0 15px;flex-wrap:wrap}.accav{width:42px;height:42px;border-radius:50%;display:inline-grid;place-items:center;background:#0a1322;border:1px solid #2b3a52;font-size:24px}.accmodal{position:fixed;inset:0;z-index:999;background:#030812cc;backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:18px}.accmodal.hidden{display:none!important}.acccard{width:min(520px,100%);background:#121d30;border:1px solid #2b3a52;border-radius:18px;padding:22px;box-shadow:0 20px 70px #0009}.accfield{margin:12px 0}.accfield label{display:block;color:#94a3b8;font-size:13px;margin-bottom:6px}.accfield input{width:100%;padding:12px;border-radius:11px;border:1px solid #2b3a52;background:#0a1322;color:#fff;font:inherit}.accmsg{display:none;padding:10px;border-radius:10px;margin-top:12px}.accmsg.err{display:block;background:#481d22;color:#fecaca}.accmsg.ok{display:block;background:#183a2b;color:#b7f7d2}.accavs{display:grid;grid-template-columns:repeat(8,1fr);gap:7px;margin:14px 0}.accchoice{height:48px;border:1px solid #2b3a52;background:#0a1322;border-radius:11px;font-size:25px;cursor:pointer}.accchoice.sel{outline:2px solid #f7c948}.accprof{display:flex;align-items:center;gap:14px}.accbig{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;background:#0a1322;border:1px solid #2b3a52;font-size:42px}@media(max-width:560px){.accavs{grid-template-columns:repeat(4,1fr)}}';document.head.appendChild(s)}
function msg(e,t,ok){e.textContent=t;e.className='accmsg '+(ok?'ok':'err')}
function setUser(x){u=x||null;let g=$('accGuest'),b=$('accUser');if(!u){g.classList.remove('hidden');b.classList.add('hidden');return}g.classList.add('hidden');b.classList.remove('hidden');$('accName').textContent=u.username;$('accAvatar').textContent=u.avatar||'😀';$('name').value=u.username;sel=u.avatar||'😀'}
function avatars(){let e=$('accAvatars');if(!e)return;e.innerHTML=A.map(a=>`<button type="button" class="accchoice ${a===sel?'sel':''}">${a}</button>`).join('');e.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{sel=A[i];$('accBig').textContent=sel;avatars()})}
function auth(reg){$('accModal').classList.remove('hidden');$('accAuth').classList.remove('hidden');$('accProfileCard').classList.add('hidden');$('accLoginForm').classList.toggle('hidden',reg);$('accRegForm').classList.toggle('hidden',!reg);$('accTitle').textContent=reg?'Zakładanie konta':'Logowanie'}
function profile(){if(!u)return;$('accModal').classList.remove('hidden');$('accAuth').classList.add('hidden');$('accProfileCard').classList.remove('hidden');$('accProfileName').textContent=u.username;sel=u.avatar||'😀';$('accBig').textContent=sel;avatars()}
function close(){const m=$('accModal');if(m)m.classList.add('hidden')}
async function login(){try{let d=await api('/api/login',{method:'POST',body:JSON.stringify({username:$('accLoginName').value.trim(),password:$('accLoginPass').value})});localStorage.setItem(K,d.token);setUser(d.user);msg($('accLoginMsg'),'Zalogowano.',1);setTimeout(close,300)}catch(e){msg($('accLoginMsg'),e.message,0)}}
async function register(){let p=$('accRegPass').value;if(p!==$('accRegPass2').value)return msg($('accRegMsg'),'Hasła nie są takie same.',0);try{let d=await api('/api/register',{method:'POST',body:JSON.stringify({username:$('accRegName').value.trim(),password:p,avatar:sel})});localStorage.setItem(K,d.token);setUser(d.user);msg($('accRegMsg'),'Konto utworzone i zalogowano.',1);setTimeout(close,300)}catch(e){msg($('accRegMsg'),e.message,0)}}
async function save(){try{let d=await api('/api/profile',{method:'POST',body:JSON.stringify({avatar:sel})});setUser(d.user);$('accBig').textContent=sel;msg($('accProfMsg'),'Ikona zapisana.',1)}catch(e){msg($('accProfMsg'),e.message,0)}}
async function logout(){try{await api('/api/logout',{method:'POST'})}catch{}localStorage.removeItem(K);setUser(null);close()}
async function restoreLogin(){const t=tok();if(!t)return;try{const d=await api('/api/me');setUser(d.user)}catch{localStorage.removeItem(K);setUser(null)}}
function build(){let h=$('home');if(!h)return;let bar=document.createElement('div');bar.className='accbar';bar.innerHTML='<div id="accGuest"><button type="button" class="btn dark" id="accLogin">Zaloguj</button> <button type="button" class="btn" id="accRegister">Załóż konto</button></div><div id="accUser" class="hidden"><span class="accav" id="accAvatar">😀</span><span class="badge" id="accName"></span> <button type="button" class="btn dark" id="accProfile">Profil</button> <button type="button" class="btn danger" id="accLogout">Wyloguj</button></div>';h.insertBefore(bar,h.firstChild);
let m=document.createElement('div');m.id='accModal';m.className='accmodal hidden';m.innerHTML='<div class="acccard" id="accAuth"><div class="top"><h2 id="accTitle">Logowanie</h2><button type="button" class="btn dark" id="accClose">Wróć</button></div><div id="accLoginForm"><div class="accfield"><label>Login</label><input id="accLoginName" autocomplete="username"></div><div class="accfield"><label>Hasło</label><input id="accLoginPass" type="password" autocomplete="current-password"></div><button type="button" class="btn" id="accLoginDo">Zaloguj</button><div id="accLoginMsg" class="accmsg"></div><p class="muted">Nie masz konta? <button type="button" class="btn dark" id="accToReg">Załóż konto</button></p></div><div id="accRegForm" class="hidden"><div class="accfield"><label>Login</label><input id="accRegName" maxlength="18" autocomplete="username"></div><div class="accfield"><label>Hasło</label><input id="accRegPass" type="password" autocomplete="new-password"></div><div class="accfield"><label>Powtórz hasło</label><input id="accRegPass2" type="password" autocomplete="new-password"></div><button type="button" class="btn" id="accRegDo">Utwórz konto</button><div id="accRegMsg" class="accmsg"></div><p class="muted">Masz już konto? <button type="button" class="btn dark" id="accToLogin">Zaloguj</button></p></div></div><div class="acccard hidden" id="accProfileCard"><div class="top"><h2>Twój profil</h2><button type="button" class="btn dark" id="accProfClose">Wróć</button></div><div class="accprof"><span class="accbig" id="accBig">😀</span><div><h3 id="accProfileName"></h3><span class="muted">Wybierz ikonę profilu</span></div></div><div class="accavs" id="accAvatars"></div><button type="button" class="btn" id="accSave">Zapisz ikonę</button><div id="accProfMsg" class="accmsg"></div></div>';document.body.appendChild(m);
$('accLogin').onclick=()=>auth(0);$('accRegister').onclick=()=>auth(1);$('accClose').onclick=e=>{e.preventDefault();e.stopPropagation();close()};$('accProfClose').onclick=e=>{e.preventDefault();e.stopPropagation();close()};$('accToReg').onclick=()=>auth(1);$('accToLogin').onclick=()=>auth(0);$('accProfile').onclick=profile;$('accLogout').onclick=logout;$('accLoginDo').onclick=login;$('accRegDo').onclick=register;$('accSave').onclick=save;m.onclick=e=>{if(e.target===m)close()};avatars();restoreLogin()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{css();build()});else{css();build()}
})();

/* Stabilne kliknięcie Utwórz/Dołącz: przechwytujemy klik przed starym handlerem i zawsze używamy aktywnego Socket.IO. */
(function(){
  function showError(text){const e=document.getElementById('homeError');if(e){e.textContent=text;e.className='status error'}}
  function room(code){const home=document.getElementById('home'),lobby=document.getElementById('lobby'),rc=document.getElementById('roomCode'),ls=document.getElementById('lobbyStatus');localStorage.setItem('planowanieRoom',code);if(rc)rc.textContent=code;if(home)home.classList.add('hidden');if(lobby)lobby.classList.remove('hidden');if(ls){ls.className='status';ls.textContent='Pokój utworzony. Czekam na połączenie z serwerem…'}}
  function waitAndEmit(event,data){const s=window.planowanieSocket;if(!s)return showError('Nie załadował się klient gry. Odśwież stronę.');const send=()=>{try{s.emit(event,data)}catch(e){showError('Nie udało się połączyć z serwerem: '+(e.message||e))}};if(s.connected)send();else{showError('Łączenie z serwerem…');s.connect();let done=false;const on=()=>{if(done)return;done=true;s.off('connect',on);send()};s.on('connect',on);setTimeout(()=>{if(!done){done=true;s.off('connect',on);showError('Serwer gry nie odpowiada. Spróbuj ponownie za chwilę.')}},15000)}}
  document.addEventListener('click',function(e){
    const create=e.target.closest&&e.target.closest('#create'),join=e.target.closest&&e.target.closest('#join');
    if(!create&&!join)return;
    e.preventDefault();e.stopImmediatePropagation();
    const name=(document.getElementById('name')?.value||'').trim()||'Gracz',token=localStorage.getItem('planowaniePlayerToken')||'';
    if(create){showError('Łączenie z serwerem…');waitAndEmit('createRoom',{name,token});return}
    const code=(document.getElementById('code')?.value||'').trim().toUpperCase();if(!code){showError('Wpisz kod pokoju.');return}showError('Łączenie z serwerem…');waitAndEmit('joinRoom',{code,name,token});
  },true);
  window.addEventListener('error',e=>{if(e&&e.message)showError('Błąd aplikacji: '+e.message)});
  window.addEventListener('unhandledrejection',e=>{const r=e&&e.reason;if(r)showError('Błąd aplikacji: '+(r.message||String(r))) });
})();