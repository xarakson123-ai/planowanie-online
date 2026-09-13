/* Gdy gracz jest zalogowany, używamy jego sesji także jako stabilnego tokenu pokoju. Dzięki temu serwer może rozpoznać konto przy stole. */
(function(){
  function sync(){
    const auth=localStorage.getItem('planowanieAuthToken');
    if(auth) localStorage.setItem('planowaniePlayerToken',auth);
  }
  sync();
  setInterval(sync,500);
})();
