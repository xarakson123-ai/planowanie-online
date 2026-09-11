const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });
app.get('/health', (_req,res)=>res.json({ok:true}));
const rooms = new Map();
const SUITS=['♣','♦','♥','♠'];
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const suitColor=s=>s==='♥'||s==='♦'?'red':'black';
const value=r=>RANKS.indexOf(r);

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function sortHand(hand){const suitOrder={'♣':0,'♦':1,'♥':2,'♠':3};hand.sort((a,b)=>value(a.r)-value(b.r)||suitOrder[a.s]-suitOrder[b.s]);}
function makeDeck(){return SUITS.flatMap(s=>RANKS.map(r=>({id:crypto.randomUUID(),key:s+'|'+r,s,r})));}
function newCode(){let c;do c=crypto.randomBytes(3).toString('hex').toUpperCase();while(rooms.has(c));return c;}
function maxHandSize(n){return n===2?24:n===3?16:n===4?12:0;}
function publicRoom(room){return {
  code:room.code, phase:room.phase, round:room.round, maxRounds:room.maxRounds, handSize:room.handSize,
  trump:room.trump, currentPlayer:room.currentPlayer, currentDeclarer:room.currentDeclarer,
  trick:room.trick.map(t=>({player:t.player,card:t.card})),
  players:room.players.map(p=>({id:p.id,name:p.name,score:p.score,decl:p.decl,won:p.won,roundPoints:p.roundPoints,connected:p.connected}))
};}
function stateFor(room,pid){const p=room.players.find(x=>x.id===pid);return {room:publicRoom(room),myId:pid,hand:p?.hand||[]};}
function send(room){for(const p of room.players){if(p.connected)io.to(p.socketRoom).emit('state',stateFor(room,p.id));}}
function p(room,id){return room.players.find(x=>x.id===id);}
function orderNext(room,id){const i=room.players.findIndex(x=>x.id===id);return room.players[(i+1)%room.players.length].id;}
function trickWinner(room){const lead=room.trick[0].card.s;let best=0;for(let i=1;i<room.trick.length;i++){const a=room.trick[i].card,b=room.trick[best].card;const at=a.s===room.trump,bt=b.s===room.trump;if(at&&!bt)best=i;else if(at===bt){const al=a.s===lead,bl=b.s===lead;if(al&&!bl)best=i;else if(al===bl&&value(a.r)>value(b.r))best=i;}}return room.trick[best].player;}
function startRound(room){
  if(room.round>room.maxRounds){room.phase='finished';send(room);return;}
  room.phase='declaration'; room.handSize=room.maxRounds-room.round+1; room.trick=[]; room.currentPlayer=null;
  room.currentDeclarer=room.players[(room.dealerIndex+1)%room.players.length].id;
  room.deck=shuffle(makeDeck()); const trumpCard=room.deck.pop(); room.trump=trumpCard.s;
  room.players.forEach(pl=>{pl.hand=[];pl.decl=null;pl.won=0;pl.roundPoints=0;for(let i=0;i<room.handSize;i++)pl.hand.push(room.deck.pop());sortHand(pl.hand);});
  send(room);
}
function advanceDeclarer(room){const next=room.players.find(pl=>pl.decl===null);if(next){room.currentDeclarer=next.id;send(room);return;}
  room.phase='play'; room.currentPlayer=room.players[(room.dealerIndex+1)%room.players.length].id; send(room);
}
function declarationLegal(room,pid,n){const pl=p(room,pid);if(!pl||room.phase!=='declaration'||room.currentDeclarer!==pid)return false;if(!Number.isInteger(n)||n<0||n>room.handSize)return false;const sumOthers=room.players.filter(x=>x.id!==pid).reduce((s,x)=>s+(x.decl??0),0);return sumOthers+n!==room.handSize;}
function play(room,pid,card){
  const pl=p(room,pid); if(!pl||room.phase!=='play'||room.currentPlayer!==pid)return 'Nie jest teraz Twoja kolej.';
  let idx=-1;
  if(card?.id) idx=pl.hand.findIndex(c=>c.id===card.id);
  if(idx<0 && card?.key) idx=pl.hand.findIndex(c=>c.key===card.key);
  if(idx<0 && card?.s && card?.r) idx=pl.hand.findIndex(c=>c.s===card.s&&c.r===card.r);
  if(idx<0)return 'Nie masz tej karty.';
  const playedCard=pl.hand[idx];
  const lead=room.trick[0]?.card.s;
  if(lead && pl.hand.some(c=>c.s===lead) && playedCard.s!==lead)return 'Musisz dołożyć do koloru.';
  pl.hand.splice(idx,1); room.trick.push({player:pid,card:playedCard});
  if(room.trick.length<room.players.length){room.currentPlayer=orderNext(room,pid);send(room);return null;}
  const winId=trickWinner(room);p(room,winId).won++;room.currentPlayer=winId;room.trick=[];
  if(room.players.every(x=>x.hand.length===0))finishRound(room); else send(room);
  return null;
}
function finishRound(room){for(const pl of room.players){pl.roundPoints=pl.won===pl.decl?10+pl.won:0;pl.score+=pl.roundPoints;}
  room.phase=room.round===room.maxRounds?'finished':'roundEnd';send(room);
  if(room.phase==='roundEnd')setTimeout(()=>{if(!rooms.has(room.code))return;room.round++;room.dealerIndex=(room.dealerIndex+1)%room.players.length;startRound(room);},1800);
}

function cleanToken(token){
  const t=String(token||'').trim();
  return t.slice(0,120);
}
function findPlayerByToken(token){
  const t=cleanToken(token);
  if(!t)return null;
  for(const room of rooms.values()){
    const player=room.players.find(x=>x.token===t);
    if(player)return {room,player};
  }
  return null;
}
function attachSocket(socket,room,player){
  socket.data.room=room.code;
  socket.data.playerId=player.id;
  player.connected=true;
  player.socketId=socket.id;
  socket.join(player.socketRoom);
  send(room);
}

io.on('connection',socket=>{
  const connectionToken=cleanToken(socket.handshake.auth?.token);
  const existing=connectionToken?findPlayerByToken(connectionToken):null;
  if(existing){
    attachSocket(socket,existing.room,existing.player);
    socket.emit('roomRestored',existing.room.code);
  }

  socket.on('createRoom',({name,token})=>{
    const t=cleanToken(token)||connectionToken||crypto.randomUUID();
    const old=findPlayerByToken(t);
    if(old){
      old.player.connected=false;
      if(old.room.phase==='lobby'){
        old.room.players=old.room.players.filter(x=>x!==old.player);
        if(old.room.players.length===0)rooms.delete(old.room.code);
      }
    }
    const code=newCode();
    const room={code,players:[],phase:'lobby',round:1,maxRounds:0,handSize:0,trump:null,currentPlayer:null,currentDeclarer:null,dealerIndex:0,deck:[],trick:[]};
    const pl={id:t,token:t,socketId:socket.id,name:String(name||'Gracz').trim().slice(0,18)||'Gracz',score:0,hand:[],decl:null,won:0,roundPoints:0,connected:true,socketRoom:`room:${code}`};
    room.players.push(pl);rooms.set(code,room);attachSocket(socket,room,pl);socket.emit('roomCreated',code);
  });

  socket.on('joinRoom',({code,name,token})=>{
    const room=rooms.get(String(code||'').trim().toUpperCase());
    if(!room)return socket.emit('errorMsg','Nie znaleziono pokoju.');
    const t=cleanToken(token)||connectionToken||crypto.randomUUID();
    const existingInRoom=room.players.find(x=>x.token===t);
    if(existingInRoom){
      existingInRoom.name=String(name||existingInRoom.name||'Gracz').trim().slice(0,18)||existingInRoom.name||'Gracz';
      attachSocket(socket,room,existingInRoom);return;
    }
    if(room.phase!=='lobby')return socket.emit('errorMsg','Gra już się rozpoczęła.');
    if(room.players.length>=4)return socket.emit('errorMsg','Pokój jest pełny — maksymalnie 4 graczy.');
    const elsewhere=findPlayerByToken(t);
    if(elsewhere){
      return socket.emit('errorMsg','Ten gracz jest już w innym pokoju.');
    }
    const pl={id:t,token:t,socketId:socket.id,name:String(name||'Gracz').trim().slice(0,18)||'Gracz',score:0,hand:[],decl:null,won:0,roundPoints:0,connected:true,socketRoom:`room:${room.code}`};
    room.players.push(pl);attachSocket(socket,room,pl);
  });

  socket.on('startGame',()=>{
    const room=rooms.get(socket.data.room);if(!room)return;
    const pid=socket.data.playerId;
    if(room.players[0]?.id!==pid)return socket.emit('errorMsg','Tylko twórca pokoju może rozpocząć.');
    if(room.players.length<2)return socket.emit('errorMsg','Potrzeba co najmniej 2 graczy.');
    room.maxRounds=maxHandSize(room.players.length);room.round=1;room.dealerIndex=0;room.players.forEach(x=>{x.score=0;x.won=0;x.decl=null;});startRound(room);
  });

  socket.on('declare',n=>{
    const room=rooms.get(socket.data.room);if(!room)return;
    const pid=socket.data.playerId;
    if(!declarationLegal(room,pid,Number(n)))return socket.emit('errorMsg','Ta deklaracja jest niedozwolona — sprawdź zasadę haka.');
    p(room,pid).decl=Number(n);advanceDeclarer(room);
  });

  socket.on('play',card=>{
    const room=rooms.get(socket.data.room);if(!room)return;
    const e=play(room,socket.data.playerId,card);if(e)socket.emit('errorMsg',e);
  });

  socket.on('disconnect',()=>{
    const room=rooms.get(socket.data.room);if(!room)return;
    const pl=p(room,socket.data.playerId);
    if(!pl)return;
    // Only mark offline if this is still the player's current socket.
    if(pl.socketId===socket.id){pl.connected=false;pl.socketId=null;send(room);}
  });
});
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`Planowanie server listening on ${PORT}`));
