const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });
app.get('/health', (_req,res)=>res.json({ok:true}));

const rooms=new Map();
const SUITS=['♣','♦','♥','♠'];
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const value=r=>RANKS.indexOf(r);
const cleanName=name=>String(name||'Gracz').trim().slice(0,18)||'Gracz';
const cleanToken=token=>String(token||'').trim().slice(0,200);

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sortHand(hand){const so={'♣':0,'♦':1,'♥':2,'♠':3};hand.sort((a,b)=>value(a.r)-value(b.r)||so[a.s]-so[b.s])}
function makeDeck(){return SUITS.flatMap(s=>RANKS.map(r=>({id:crypto.randomUUID(),key:`${s}|${r}`,s,r})))}
function newCode(){let c;do c=crypto.randomBytes(3).toString('hex').toUpperCase();while(rooms.has(c));return c}
function maxHandSize(n){return n===2?24:n===3?16:n===4?12:0}
function findPlayer(room,id){return room.players.find(x=>x.id===id)}
function findPlayerByToken(room,token){return token?room.players.find(x=>x.token===token):null}

function publicRoom(room){
return {code:room.code,phase:room.phase,round:room.round,maxRounds:room.maxRounds,handSize:room.handSize,trump:room.trump,currentPlayer:room.currentPlayer,currentDeclarer:room.currentDeclarer,trick:room.trick.map(t=>({player:t.player,card:t.card})),players:room.players.map(p=>({id:p.id,name:p.name,score:p.score,decl:p.decl,won:p.won,roundPoints:p.roundPoints,connected:p.connected}))}
}
function stateFor(room,playerId){const pl=findPlayer(room,playerId);return {room:publicRoom(room),myId:playerId,hand:pl?.hand||[]}}
function send(room){for(const pl of room.players)if(pl.connected&&pl.socketId)io.to(pl.socketId).emit('state',stateFor(room,pl.id))}
function attachSocket(socket,room,pl){pl.socketId=socket.id;pl.connected=true;socket.data.room=room.code;socket.data.playerId=pl.id;socket.data.token=pl.token;socket.join(pl.socketRoom)}
function orderNext(room,id){const i=room.players.findIndex(x=>x.id===id);return room.players[(i+1)%room.players.length].id}

function trickWinner(room){
const lead=room.trick[0].card.s;let best=0;
for(let i=1;i<room.trick.length;i++){const a=room.trick[i].card,b=room.trick[best].card,at=a.s===room.trump,bt=b.s===room.trump;
if(at&&!bt)best=i;else if(at===bt){const al=a.s===lead,bl=b.s===lead;if(al&&!bl)best=i;else if(al===bl&&value(a.r)>value(b.r))best=i}}
return room.trick[best].player
}
function startRound(room){
if(room.round>room.maxRounds){room.phase='finished';send(room);return}
room.phase='declaration';room.handSize=room.maxRounds-room.round+1;room.trick=[];room.currentPlayer=null;
room.currentDeclarer=room.players[(room.dealerIndex+1)%room.players.length].id;
room.deck=shuffle(makeDeck());const trumpCard=room.deck.pop();room.trump=trumpCard.s;
room.players.forEach(pl=>{pl.hand=[];pl.decl=null;pl.won=0;pl.roundPoints=0;for(let i=0;i<room.handSize;i++)pl.hand.push(room.deck.pop());sortHand(pl.hand)});
send(room)
}
function advanceDeclarer(room){
const next=room.players.find(pl=>pl.decl===null);
if(next){room.currentDeclarer=next.id;send(room);return}
room.phase='play';room.currentPlayer=room.players[(room.dealerIndex+1)%room.players.length].id;send(room)
}
function declarationLegal(room,playerId,n){
const pl=findPlayer(room,playerId);if(!pl||room.phase!=='declaration'||room.currentDeclarer!==playerId)return false;
if(!Number.isInteger(n)||n<0||n>room.handSize)return false;
const sumOthers=room.players.filter(x=>x.id!==playerId).reduce((s,x)=>s+(x.decl??0),0);
return sumOthers+n!==room.handSize
}
function finishRound(room){
for(const pl of room.players){pl.roundPoints=pl.won===pl.decl?10+pl.won:0;pl.score+=pl.roundPoints}
room.phase=room.round===room.maxRounds?'finished':'roundEnd';send(room);
if(room.phase==='roundEnd')setTimeout(()=>{if(!rooms.has(room.code))return;room.round++;room.dealerIndex=(room.dealerIndex+1)%room.players.length;startRound(room)},1800)
}
function play(room,playerId,card){
const pl=findPlayer(room,playerId);
if(!pl||room.phase!=='play'||room.currentPlayer!==playerId)return'Nie jest teraz Twoja kolej.';
const wantedId=String(card?.id||'').trim(),wantedKey=String(card?.key||'').trim(),wantedSuit=String(card?.s||'').trim(),wantedRank=String(card?.r||'').trim();
let idx=-1;
if(wantedId)idx=pl.hand.findIndex(c=>String(c.id)===wantedId);
if(idx<0&&wantedKey)idx=pl.hand.findIndex(c=>String(c.key)===wantedKey);
if(idx<0&&wantedSuit&&wantedRank)idx=pl.hand.findIndex(c=>c.s===wantedSuit&&c.r===wantedRank);
if(idx<0){console.log(`[PLAY] karta nie znaleziona room=${room.code} player=${pl.name} id=${wantedId} key=${wantedKey} card=${wantedRank}${wantedSuit}`);return'Nie mam takiej karty w tej ręce. Odświeżam Twoją rękę.'}
const playedCard=pl.hand[idx],lead=room.trick[0]?.card.s;
if(lead&&pl.hand.some(c=>c.s===lead)&&playedCard.s!==lead)return'Musisz dołożyć do koloru.';
pl.hand.splice(idx,1);room.trick.push({player:playerId,card:playedCard});
if(room.trick.length<room.players.length){room.currentPlayer=orderNext(room,playerId);send(room);return null}
const winId=trickWinner(room),winner=findPlayer(room,winId);if(winner)winner.won++;
room.currentPlayer=winId;room.trick=[];
if(room.players.every(x=>x.hand.length===0))finishRound(room);else send(room);
return null
}

function createPlayer(name,token){return{id:crypto.randomUUID(),token,name:cleanName(name),score:0,hand:[],decl:null,won:0,roundPoints:0,connected:false,socketId:null,socketRoom:null}}

io.on('connection',socket=>{
socket.on('resume',({code,token}={})=>{const room=rooms.get(String(code||'').trim().toUpperCase()),stableToken=cleanToken(token);if(!room||!stableToken)return;const pl=findPlayerByToken(room,stableToken);if(!pl)return;attachSocket(socket,room,pl);socket.emit('resumed',room.code);send(room)});
socket.on('createRoom',({name,token}={})=>{const stableToken=cleanToken(token)||crypto.randomUUID(),code=newCode(),room={code,players:[],phase:'lobby',round:1,maxRounds:0,handSize:0,trump:null,currentPlayer:null,currentDeclarer:null,dealerIndex:0,deck:[],trick:[]},pl=createPlayer(name,stableToken);pl.socketRoom=`room:${code}`;room.players.push(pl);rooms.set(code,room);attachSocket(socket,room,pl);socket.emit('roomCreated',code);send(room)});
socket.on('joinRoom',({code,name,token}={})=>{const room=rooms.get(String(code||'').trim().toUpperCase()),stableToken=cleanToken(token)||crypto.randomUUID();if(!room)return socket.emit('errorMsg','Nie znaleziono pokoju.');if(room.phase!=='lobby')return socket.emit('errorMsg','Gra już się rozpoczęła.');
const existing=findPlayerByToken(room,stableToken);if(existing){existing.name=cleanName(name||existing.name);attachSocket(socket,room,existing);socket.emit('roomJoined',room.code);send(room);return}
if(room.players.length>=4)return socket.emit('errorMsg','Pokój jest pełny — maksymalnie 4 graczy.');
const pl=createPlayer(name,stableToken);pl.socketRoom=`room:${room.code}`;room.players.push(pl);attachSocket(socket,room,pl);socket.emit('roomJoined',room.code);send(room)
});
socket.on('startGame',()=>{const room=rooms.get(socket.data.room),playerId=socket.data.playerId;if(!room||!playerId)return;if(room.players[0]?.id!==playerId)return socket.emit('errorMsg','Tylko twórca pokoju może rozpocząć.');if(room.players.length<2)return socket.emit('errorMsg','Potrzeba co najmniej 2 graczy.');room.maxRounds=maxHandSize(room.players.length);room.round=1;room.dealerIndex=0;room.players.forEach(x=>x.score=0);startRound(room)});
socket.on('declare',n=>{const room=rooms.get(socket.data.room),playerId=socket.data.playerId;if(!room||!playerId)return;const bid=Number(n);if(!declarationLegal(room,playerId,bid))return socket.emit('errorMsg','Ta deklaracja jest niedozwolona — sprawdź zasadę haka.');findPlayer(room,playerId).decl=bid;advanceDeclarer(room)});
socket.on('play',card=>{const room=rooms.get(socket.data.room),playerId=socket.data.playerId;if(!room||!playerId)return;const error=play(room,playerId,card);if(error){socket.emit('errorMsg',error);send(room)}});
socket.on('requestState',()=>{const room=rooms.get(socket.data.room),playerId=socket.data.playerId;if(!room||!playerId)return;const pl=findPlayer(room,playerId);if(!pl)return;pl.socketId=socket.id;pl.connected=true;send(room)});
socket.on('disconnect',()=>{const room=rooms.get(socket.data.room),playerId=socket.data.playerId;if(!room||!playerId)return;const pl=findPlayer(room,playerId);if(!pl)return;if(pl.socketId===socket.id){pl.connected=false;pl.socketId=null}send(room)})
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Planowanie server listening on ${PORT}`));
