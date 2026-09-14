/* Stable frontend loader: execute feature scripts in order without document.write().
   The old document.write chain could corrupt the parser/DOM on some hosts and
   leave the page blank. Synchronous XHR is intentional here: the main game
   script below must not start until every feature script has been evaluated. */
(function(){
  const files=[
    'config-base.js',
    'social-sync.js',
    'social.js',
    'social-fix.js',
    'enhancements.js',
    'fix-v10.js',
    'stake-ui.js',
    'profile-photo-ui.js',
    'score-v10.js',
    'sound-v10.js',
    'shop-ad-v10.js',
    'v11-ui.js',
    'v12-ui.js',
    'ad-v12.js'
  ];

  function fail(name, message){
    console.error('[Planowanie] Nie udało się załadować '+name+':',message);
    const show=()=>{
      const e=document.getElementById('homeError');
      if(e){
        e.textContent='Błąd ładowania '+name+'. Odśwież stronę. ('+message+')';
        e.className='status error';
      }
    };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',show,{once:true});
    else show();
  }

  for(const name of files){
    const xhr=new XMLHttpRequest();
    try{
      xhr.open('GET',name,false);
      xhr.send(null);
      if(xhr.status!==200 && xhr.status!==0) throw new Error('HTTP '+xhr.status);
      if(!xhr.responseText) throw new Error('pusta odpowiedź');
      window.eval(xhr.responseText+'\n//# sourceURL='+name);
    }catch(err){
      fail(name,err&&err.message?err.message:String(err));
      break;
    }
  }
})();
