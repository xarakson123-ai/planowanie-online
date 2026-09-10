const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const crypto=require('crypto');
const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:'*',methods:['GET','POST']}});
const rooms=new Map();
const suits=['♣','♦','♥','♠'];
const ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const rankValue=r=>ranks.indexOf(r);
function createDeck(){return suits.flatMap(s=>ranks.map(r=>({s,r})));}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function roomCode(){let c;do c=crypto.randomBytes(3).toString('hex').toUpperCase();while(rooms.has(c));return c;}
function player(room,id){return room.players.find(p=>p.id===id);}
function nextId(room,id){const i=room.players.findIndex(p=>p.id===id);return room.players[(i+1)%room.players.length].id;}
function trickWinner(trick,lead,trump){let best=0;for(let i=1;i<trick.length;i++){const a=trick[i],b=trick[best];const at=a.card.s===trump,bt=b.card.s===trump;if(at&&!bt)best=i;else if(at===bt){const al=a.card.s===lead,bl=b.card.s===lead;if(al&&!bl)best=i;else if(al===bl&&rankValue(a.card.r)>rankValue(b.card.r))best=i;}}return trick[best].player;}
function publicState(room){return {code:room.code,phase:room.phase,round:room.round,handSize:room.handSize,trump:room.trump,currentPlayer:room.currentPlayer,currentDeclarer:room.currentDeclarer,players:room.players.map(p=>({id:p.id,name:p.name,score:p.score,decl:p.decl,won:p.won}))};}
function sendState(room){for(const p of room.players){io.to(p.socketRoom).emit('state',{room:publicState(room),myId:p.id,hand:p.hand,trick:room.trick.map(t=>({player:t.player,card:t.card}))});}}
function error(socket,msg){socket.emit('errorMsg',msg);}
function startRound(room){room.phase='declaration';room.handSize=room.round;room.trick=[];room.currentPlayer=null;room.currentDeclarer=room.players[(room.round-1)%room.players.length].id;room.deck=shuffle(createDeck());const trump=room.deck.pop();room.trump=trump.s;room.players.forEach(p=>{p.hand=[];p.decl=null;p.won=0;for(let i=0;i<room.handSize;i++)p.hand.push(room.deck.pop());});sendState(room);}
function advanceDeclaration(room){const remaining=room.players.find(p=>p.decl===null);if(remaining){room.currentDeclarer=remaining.id;sendState(room);return;}room.phase='play';room.currentPlayer=room.players[0].id;sendState(room);}
function validDeclaration(room,pid,n){const p=player(room,pid);if(!p||room.phase!=='declaration'||room.currentDeclarer!==pid)return false;if(!Number.isInteger(n)||n<0||n>room.handSize)return false;const others=room.players.filter(x=>x.id!==pid).reduce((s,x)=>s+(x.decl??0),0);return others+n!==room.handSize;}
function scoreRound(room){for(const p of room.players){if(p.won===p.decl)p.score+=10+p.won;}room.phase='roundEnd';sendState(room);setTimeout(()=>{if(!rooms.has(room.code))return;if(room.round>=7){room.phase='finished';sendState(room);return;}room.round++;startRound(room);},1200);}
function play(room,socket,card){const p=player(room,socket.id);if(!p||room.phase!=='play'||room.currentPlayer!==p.id){return 'Nie jest teraz Twoja kolej.';}const idx=p.hand.findIndex(c=>c.s===card?.s&&c.r===card?.r);if(idx<0)return 'Nie masz tej karty.';const lead=room.trick[0]?.card.s;if(lead&&p.hand.some(c=>c.s===lead)&&card.s!==lead)return 'Musisz dołożyć do koloru.';p.hand.splice(idx,1);room.trick.push({player:p.id,card});if(room.trick.length<room.players.length){room.currentPlayer=nextId(room,p.id);sendState(room);return null;}const winnerId=trickWinner(room.trick,lead,room.trump);player(room,winnerId).won++;room.currentPlayer=winnerId;room.trick=[];if(room.players.every(x=>x.hand.length===0)){scoreRound(room);return null;}sendState(room);return null;}
io.on('connection',socket=>{
  socket.on('createRoom',({name})=>{const code=roomCode();const p={id:socket.id,name:String(name||'Gracz').slice(0,18),score:0,decl:null,won:0,hand:[],socketRoom:`room:${code}`};const room={code,players:[p],round:1,handSize:1,phase:'lobby',trump:null,currentPlayer:null,currentDeclarer:null,trick:[],deck:[]};rooms.set(code,room);socket.data.room=code;socket.join(p.socketRoom);socket.emit('roomCreated',code);sendState(room);});
  socket.on('joinRoom',({code,name})=>{const room=rooms.get(String(code||'').toUpperCase());if(!room)return error(socket,'Nie znaleziono pokoju.');if(room.phase!=='lobby')return error(socket,'Gra już się rozpoczęła.');if(room.players.length>=4)return error(socket,'Pokój jest pełny.');const p={id:socket.id,name:String(name||'Gracz').slice(0,18),score:0,decl:null,won:0,hand:[],socketRoom:`room:${room.code}`};room.players.push(p);socket.data.room=room.code;socket.join(p.socketRoom);sendState(room);});
  socket.on('startGame',()=>{const room=rooms.get(socket.data.room);if(!room)return;if(room.players[0].id!==socket.id)return error(socket,'Tylko twórca pokoju może rozpocząć.');if(room.players.length<2)return error(socket,'Potrzeba co najmniej 2 graczy.');startRound(room);});
  socket.on('declare',n=>{const room=rooms.get(socket.data.room);if(!room)return;if(!validDeclaration(room,socket.id,Number(n)))return error(socket,'Ta deklaracja jest niedozwolona.');player(room,socket.id).decl=Number(n);advanceDeclaration(room);});
  socket.on('play',card=>{const room=rooms.get(socket.data.room);if(!room)return;const e=play(room,socket,card);if(e)error(socket,e);});
  socket.on('disconnect',()=>{const room=rooms.get(socket.data.room);if(!room)return;room.players=room.players.filter(p=>p.id!==socket.id);if(room.players.length===0){rooms.delete(room.code);return;}if(room.phase!=='lobby'&&room.phase!=='finished'){room.phase='lobby';room.round=1;room.players.forEach(p=>{p.score=0;p.hand=[];p.decl=null;p.won=0;});room.trump=null;room.currentPlayer=null;room.currentDeclarer=null;room.trick=[];}sendState(room);});
});
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`Planowanie server listening on ${PORT}`));
