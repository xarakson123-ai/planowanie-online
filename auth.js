(function(){
  const SERVER=window.PLANOWANIE_SERVER;
  let token=localStorage.getItem('planowanieAuthToken')||'';
  window.PLANOWANIE_AUTH_TOKEN=token;
  const originalIo=window.io;
  if(typeof originalIo==='function')window.io=function(url,opts){opts=opts||{};opts.auth=Object.assign({},opts.auth||{},{token:window.PLANOWANIE_AUTH_TOKEN||''});return originalIo(url,opts)};
  const css=document.createElement('style');css.textContent='#accountButtons{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}#accountButtons .btn{min-width:150px}.authModal{position:fixed;inset:0;z-index:9999;display:none;place-items:center;background:#06131fdd;padding:18px}.authModal.show{display:grid}.authBox{width:min(460px,94vw);background:#0d2333;border:1px solid #385568;border-radius:16px;padding:26px;box-shadow:0 25px 70px #000c;color:#eef3f5;font-family:Georgia,serif}.authBox h2{margin:0;color:#f3d47f;text-align:center;font-size:32px}.authBox .sub{text-align:center;color:#9daeba;font:13px Arial;margin:6px 0 20px}.authBox input{width:100%;box-sizing:border-box;margin:7px 0;padding:13px;border-radius:9px;border:1px solid #38566c;background:#071420;color:#fff;font-size:15px}.authBox button{width:100%;margin-top:9px;padding:12px;border-radius:8px;border:1px solid #79c9ee;color:#fff;background:#075c88;font:800 13px Arial;cursor:pointer}.authBox button.alt{background:#152737;border-color:#536b7e}.authMsg{min-height:20px;margin-top:12px;text-align:center;font:13px Arial;color:#fca5a5}.authUser{display:flex;align-items:center;gap:8px;margin-top:12px;font:12px Arial;color:#eef3f5}.authUser button{padding:6px 10px;border-radius:6px;border:1px solid #536b7e;background:#152737;color:#fff;cursor:pointer}';document.head.appendChild(css);
  function modal(mode){
    let m=document.getElementById('authModal');
    if(!m){
      m=document.createElement('div');m.id='authModal';m.className='authModal';
      m.innerHTML='<div class="authBox"><h2 id="authTitle">♠ Konto Planowanie</h2><div id="authSub" class="sub"></div><input id="authName" maxlength="18" placeholder="Nazwa użytkownika"><input id="authPass" type="password" minlength="6" placeholder="Hasło"><button id="authLogin">Zaloguj się</button><button id="authRegister" class="alt">Utwórz konto</button><button id="authClose" class="alt">Anuluj</button><div id="authMsg" class="authMsg"></div></div>';
      document.body.appendChild(m);authLogin.onclick=login;authRegister.onclick=register;authClose.onclick=()=>m.classList.remove('show');m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')});
    }
    const reg=mode==='register';
    document.getElementById('authTitle').textContent=reg?'♠ Utwórz konto':'♠ Zaloguj się';
    document.getElementById('authSub').textContent=reg?'Załóż konto, aby grać online':'Zaloguj się na swoje konto';
    document.getElementById('authMsg').textContent='';
    m.classList.add('show');
    setTimeout(()=>document.getElementById('authName').focus(),30);
  }
  function message(t){const e=document.getElementById('authMsg');if(e)e.textContent=t;}
  async function request(path,body){const r=await fetch(SERVER+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Błąd serwera.');return d;}
  function logged(username){
    window.PLANOWANIE_AUTH_TOKEN=token;localStorage.setItem('planowanieAuthToken',token);
    const m=document.getElementById('authModal');if(m)m.classList.remove('show');
    let u=document.getElementById('authUser');if(!u){u=document.createElement('div');u.id='authUser';u.className='authUser';document.body.appendChild(u)}
    u.innerHTML='<span>Zalogowany: '+username+'</span><button id="authLogout">Wyloguj</button>';
    authLogout.onclick=async()=>{try{await fetch(SERVER+'/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})}catch(e){}localStorage.removeItem('planowanieAuthToken');token='';window.PLANOWANIE_AUTH_TOKEN='';location.reload()};
    const loginBtn=document.getElementById('menuLogin');const regBtn=document.getElementById('menuRegister');if(loginBtn)loginBtn.remove();if(regBtn)regBtn.remove();
  }
  async function login(){try{const d=await request('/auth/login',{username:document.getElementById('authName').value.trim(),password:document.getElementById('authPass').value});token=d.token;localStorage.setItem('planowanieAuthToken',token);location.reload()}catch(e){message(e.message)}}
  async function register(){try{const d=await request('/auth/register',{username:document.getElementById('authName').value.trim(),password:document.getElementById('authPass').value});token=d.token;localStorage.setItem('planowanieAuthToken',token);location.reload()}catch(e){message(e.message)}}
  function menu(){
    let home=document.querySelector('.home');if(!home)home=document.getElementById('home');if(!home)return;if(document.getElementById('accountButtons'))return;
    const box=document.createElement('div');box.id='accountButtons';box.innerHTML='<button id="menuLogin" class="btn dark" type="button">Zaloguj się</button><button id="menuRegister" class="btn" type="button">Utwórz konto</button>';home.appendChild(box);
    document.getElementById('menuLogin').onclick=()=>modal('login');
    document.getElementById('menuRegister').onclick=()=>modal('register');
  }
  async function boot(){
    menu();
    if(token){try{const r=await fetch(SERVER+'/auth/me',{headers:{Authorization:'Bearer '+token}});if(r.ok){const d=await r.json();logged(d.username)}else{localStorage.removeItem('planowanieAuthToken');token='';window.PLANOWANIE_AUTH_TOKEN=''}}catch(e){}}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
