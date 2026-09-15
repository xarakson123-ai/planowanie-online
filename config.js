window.PLANOWANIE_SERVER='https://planowanie-server.onrender.com';
window.PLANOWANIE_AUTH_TOKEN=localStorage.getItem('planowanieAuthToken')||'';
(function(){
  const s=document.createElement('script');
  s.src='auth.js';
  s.defer=true;
  document.head.appendChild(s);
})();
