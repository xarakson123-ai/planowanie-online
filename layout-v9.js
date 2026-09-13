(function(){
const S=window.planowanieSocket;
let creator=false;
function css(){if(document.getElementById('layoutV9Css'))return;const s=document.createElement('style');s.id='layoutV9Css';s.textContent=`
.gameBottom{grid-template-columns:minmax(0,1fr)!important}.paper.v8Paper{min-width:0!important;width:100%!important}.paper.v8Paper table{min-width:100%!important;width:100%!important;table-layout:auto}.v8PaperWrap{width:100%!important;overflow-x:visible!important}.paper.v8Paper th,.paper.v8Paper td{white-space:nowrap;padding:7px 8px}.v8Scaled{width:100%}
`;document.head.appendChild(s)}
function lobby(stake,max){localStorage.setItem('planowanieRoomStake',String(stake||0));localStorage.setItem('planowanieRoomMax',String(max||4));const b=document.querySelector('#lobby .badge');if(b)b.textContent='2–'+(max||4)+' graczy';const s=document.querySelector('#lobbyStatus');if(s&&!document.querySelector('#lobby .error')){const n=document.querySelectorAll('#lobbyPlayers .pl').length;s.textContent='Gracze: '+n+'/'+(max||4)}}
if(S){S.on('roomCreated',()=>{creator=true;setTimeout(()=>document.getElementById('stakeOverlay')?.remove(),120)});S.on('roomJoined',()=>{creator=false});S.on('stakeInfo',x=>{if(x?.maxPlayers)lobby(x.stake,x.maxPlayers);if(creator||x?.ready===true)document.getElementById('stakeOverlay')?.remove()});S.on('state',st=>{if(st?.room?.stake!=null)lobby(st.room.stake,st.room.maxPlayers||Number(localStorage.getItem('planowanieRoomMax')||4));setTimeout(()=>{const max=Number(localStorage.getItem('planowanieRoomMax')||4),s=document.getElementById('lobbyStatus'),n=document.querySelectorAll('#lobbyPlayers .pl').length;if(s&&document.getElementById('lobby')&&!document.getElementById('lobby').classList.contains('hidden'))s.textContent='Gracze: '+n+'/'+max},100)})}
const mo=new MutationObserver(()=>{css();if(creator)document.getElementById('stakeOverlay')?.remove()});mo.observe(document.body,{childList:true,subtree:true});setTimeout(css,100);
})();
