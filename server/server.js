const http=require('http');
const express=require('express');
const {Server}=require('socket.io');
const crypto=require('crypto');
const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:'*',methods:['GET','POST']}});
const rooms=new Map();
const SUITS=['♣','♦','♥','♠'];
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const value=r=>RANKS.indexOf(r);
const clean=x=>String(x||'').trim().slice(0,18);
function deck(){return SUITS.flatMap(s=>RANKS.map(r=>({id:crypto.randomUUID(),key:s+'|'+r,s,r})))}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sortHand(h){const so={'♣':0,'♦':1,'♥':2,'♠':3};h.sort((a,b)=>value(a.r)-value(b.r)||(so[a.s]-so[b.s]))}
function handSize(players){return players===2?7:players===3?7:7}
function publicRoom(r){return {code:r.code,phase:r.phase,round:r.round,maxRounds:r.maxRounds,handSize:r.handSize,trump:r.trump,currentPlayer:r.currentPlayer,currentDeclarer:r.currentDeclarer,currentTrumpChooser:r.currentTrumpChooser,trick:r.trick,players:r.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,decl:p.decl,won:p.won,connected:p.connected,ready:p.ready}))}}
function send(r){for(const p of r.players)if(p.connected)io.to(p.socket).emit('state',{room:publicRoom(r),myId:p.id,hand:p.hand})}
function find(r,id){return r&&r.players.find(p=>p.id===id)}
function next(r,id){const i=r.players.findIndex(p=>p.id===id);return r.players[(i+1)%r.players.length].id}
function winner(r){const lead=r.trick[0].card.s;let wi=0;for(let i=1;i<r.trick.length;i++){const a=r.trick[i].card,b=r.trick[wi].card;if(a.s===r.trump&&b.s!==r.trump)wi=i;else if(a.s===b.s&&a.s===lead&&value(a.r)>value(b.r))wi=i}return r.trick[wi].player}
function startRound(r){r.round++;if(r.round>r.maxRounds)return finish(r);r.phase='trump';r.handSize=r.maxRounds-r.round+1;r.trump=null;r.trick=[];r.currentPlayer=null;r.currentDeclarer=null;r.currentTrumpChooser=r.players[(r.dealer+1)%r.players.length].id;const d=shuffle(deck());for(const p of r.players){p.hand=[];p.decl=null;p.won=0;for(let i=0;i<r.handSize;i++)p.hand.push(d.pop());sortHand(p.hand)}send(r)}
function begin(r){r.maxRounds=7;r.round=0;r.dealer=0;for(const p of r.players){p.score=0;p.ready=true}startRound(r)}
function finishRound(r){for(const p of r.players)p.score+=(p.won===p.decl?10+p.won:0);r.phase='roundEnd';send(r);setTimeout(()=>{if(rooms.has(r.code)){r.dealer=(r.dealer+1)%r.players.length;startRound(r)}},1400)}
function finish(r){r.phase='finished';send(r)}
app.get('/health',(req,res)=>res.json({ok:true,rooms:rooms.size}));
io.on('connection',socket=>{
 socket.on('createRoom',x=>{const p={id:crypto.randomUUID(),name:clean(x?.name)||'Gracz',avatar:x?.avatar||'😀',score:0,hand:[],decl:null,won:0,connected:true,socket:socket.id,ready:true};const r={code:crypto.randomBytes(3).toString('hex').toUpperCase(),players:[p],phase:'lobby',round:0,maxRounds:0,handSize:0,trump:null,currentPlayer:null,currentDeclarer:null,currentTrumpChooser:null,dealer:0,trick:[]};rooms.set(r.code,r);socket.data={room:r.code,player:p.id};socket.join('room:'+r.code);socket.emit('roomCreated',r.code);send(r)});
 socket.on('joinRoom',x=>{const r=rooms.get(String(x?.code||'').toUpperCase());if(!r)return socket.emit('errorMsg','Nie znaleziono pokoju.');if(r.phase!=='lobby'||r.players.length>=4)return socket.emit('errorMsg','Pokój jest pełny lub gra już trwa.');const p={id:crypto.randomUUID(),name:clean(x?.name)||'Gracz',avatar:x?.avatar||'😀',score:0,hand:[],decl:null,won:0,connected:true,socket:socket.id,ready:true};r.players.push(p);socket.data={room:r.code,player:p.id};socket.join('room:'+r.code);socket.emit('roomJoined',r.code);send(r)});
 socket.on('startGame',()=>{const r=rooms.get(socket.data.room),p=find(r,socket.data.player);if(!r||!p)return;if(r.players[0].id!==p.id)return socket.emit('errorMsg','Tylko twórca pokoju może rozpocząć.');if(r.players.length<2)return socket.emit('errorMsg','Potrzebujesz co najmniej 2 graczy.');begin(r)});
 socket.on('chooseTrump',s=>{const r=rooms.get(socket.data.room);if(!r||r.phase!=='trump'||r.currentTrumpChooser!==socket.data.player)return;if(!SUITS.includes(s))return;r.trump=s;r.phase='declaration';r.currentDeclarer=r.currentTrumpChooser;send(r)});
 socket.on('declare',n=>{const r=rooms.get(socket.data.room),p=find(r,socket.data.player);if(!r||!p||r.phase!=='declaration'||r.currentDeclarer!==p.id)return;n=Number(n);if(!Number.isInteger(n)||n<0||n>r.handSize)return;p.decl=n;const i=r.players.indexOf(p);if(i===r.players.length-1){r.phase='play';r.currentPlayer=r.players[(r.dealer+1)%r.players.length].id}else r.currentDeclarer=r.players[i+1].id;send(r)});
 socket.on('play',c=>{const r=rooms.get(socket.data.room),p=find(r,socket.data.player);if(!r||!p||r.phase!=='play'||r.currentPlayer!==p.id)return;const i=p.hand.findIndex(x=>String(x.id)===String(c?.id)||String(x.key)===String(c?.key));if(i<0)return socket.emit('errorMsg','Nie masz tej karty.');const card=p.hand[i];const lead=r.trick[0]?.card.s;if(lead&&p.hand.some(x=>x.s===lead)&&card.s!==lead)return socket.emit('errorMsg','Musisz dołożyć do koloru.');p.hand.splice(i,1);r.trick.push({player:p.id,card});if(r.trick.length<r.players.length){r.currentPlayer=next(r,p.id);return send(r)}const w=winner(r),wp=find(r,w);if(wp)wp.won++;r.currentPlayer=w;const old=r.trick;send(r);setTimeout(()=>{if(r.trick!==old)return;r.trick=[];if(r.players.every(x=>x.hand.length===0))finishRound(r);else send(r)},1000)});
 socket.on('requestState',()=>{const r=rooms.get(socket.data.room);if(r)send(r)});
 socket.on('leaveRoom',()=>{const r=rooms.get(socket.data.room),p=find(r,socket.data.player);if(!r||!p)return;r.players=r.players.filter(x=>x.id!==p.id);if(!r.players.length)rooms.delete(r.code);else send(r);socket.disconnect(true)});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.room),p=find(r,socket.data.player);if(p&&p.socket===socket.id){p.connected=false;p.socket=null;send(r)}});
});
server.listen(process.env.PORT||3000,()=>console.log('Planowanie basic server listening on '+(process.env.PORT||3000)));
