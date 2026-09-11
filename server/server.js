const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const crypto=require('crypto');
const app=express();
const httpServer=http.createServer(app);
const io=new Server(httpServer,{cors:{origin:'*',methods:['GET','POST']}});
app.get('/',(_,res)=>res.send('Planowanie server OK'));
app.get('/health',(_,res)=>res.json({ok:true}));
const rooms=new Map();
const SUITS=['♣','♦','♥','♠']; const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const deck=()=>SUITS.flatMap(s=>RANKS.map(r=>({s,r,id:r+s})));
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const findP=(room,id)=>room.players.find(p=>p.id===id);
function publicRoom(r){return {code:r.code,phase:r.phase,players:r.players.map(p=>({id:p.id,name:p.name,score:p.score,decl:p.decl,won:p.won,connected:!!p.connected})),round:r.round,handSize:r.handSize,trump:r.trump,currentPlayer:r.currentPlayer,currentDeclarer:r.currentDeclarer,trick:r.trick};}
function send(r){for(const p of r.players) if(p.socketId) io.to(p.socketId).emit('state',{room:publicRoom(r),myId:p.id,hand:p.hand});}
function code(){let c;do c=Math.random().toString(36).slice(2,8).toUpperCase();while(rooms.has(c));return c;}
function dealRound(r){let d=shuffle(deck());r.trump=d.pop();r.handSize=Math.floor(d.length/r.players.length);r.players.forEach(p=>{p.hand=d.splice(0,r.handSize);p.decl=null;p.won=0});r.phase='declaration';r.trick=[];r.currentPlayer=r.players[0].id;r.currentDeclarer=r.players[0].id;send(r);}
function legalDecl(r,pid,n){if(r.phase!=='declaration'||r.currentDeclarer!==pid)return false;if(!Number.isInteger(n)||n<0||n>r.handSize)return false;const total=r.players.reduce((a,p)=>a+(p.decl==null?0:p.decl),0);return total+n!==r.handSize;}
function nextDecl(r){const i=r.players.findIndex(p=>p.id===r.currentDeclarer);const un=r.players.filter(p=>p.decl==null);if(!un.length){r.phase='play';r.currentPlayer=r.players[0].id;send(r);return}for(let k=1;k<=r.players.length;k++){const p=r.players[(i+k)%r.players.length];if(p.decl==null){r.currentDeclarer=p.id;send(r);return}}}
function cardBeats(a,b,lead,trump){if(a.s===b.s)return RANKS.indexOf(a.r)>RANKS.indexOf(b.r);if(a.s===trump&&b.s!==trump)return true;if(b.s===trump&&a.s!==trump)return false;return a.s===lead&&b.s!==lead;}
function play(r,pid,card){if(r.phase!=='play')return 'Teraz nie można zagrywać kart.';if(r.currentPlayer!==pid)return 'To nie jest Twoja kolej.';const p=findP(r,pid);const i=p.hand.findIndex(c=>c.id===card.id);if(i<0)return 'Nie masz tej karty na ręce.';const lead=r.trick[0]?.card.s;if(lead&&p.hand.some(c=>c.s===lead)&&card.s!==lead)return 'Musisz dołożyć do koloru.';const c=p.hand.splice(i,1)[0];r.trick.push({player:pid,card:c});if(r.trick.length<2 && r.players.length>2 || r.trick.length<r.players.length){const idx=r.players.findIndex(x=>x.id===pid);r.currentPlayer=r.players[(idx+1)%r.players.length].id;send(r);return null;}let winner=r.trick[0];for(const t of r.trick.slice(1))if(cardBeats(t.card,winner.card,lead,r.trump.s))winner=t;r.trick.forEach(t=>findP(r,t.player).won++);r.currentPlayer=winner.player;setTimeout(()=>{r.trick=[];if(r.players[0].hand.length===0){r.players.forEach(p=>{p.score+=(p.decl===p.won?10+p.won:0)});r.phase='finished';r.currentPlayer=null;r.currentDeclarer=null;send(r);}else send(r)},700);send(r);return null;}
io.on('connection',socket=>{
 socket.on('createRoom',({name,token})=>{const id=String(token||'').trim()||crypto.randomUUID();const c=code();const r={code:c,players:[],phase:'lobby',round:1,handSize:0,trump:null,currentPlayer:null,currentDeclarer:null,trick:[]};const p={id,socketId:socket.id,name:String(name||'Gracz').trim().slice(0,18)||'Gracz',score:0,hand:[],decl:null,won:0,connected:true};r.players.push(p);rooms.set(c,r);socket.data.room=c;socket.data.playerId=id;socket.emit('roomCreated',c);send(r);});
 socket.on('joinRoom',({code:raw,name,token})=>{const r=rooms.get(String(raw||'').trim().toUpperCase());if(!r)return socket.emit('errorMsg','Nie znaleziono pokoju.');const tokenId=String(token||'').trim();const ex=r.players.find(p=>p.id===tokenId);if(ex){ex.socketId=socket.id;ex.connected=true;socket.data.room=r.code;socket.data.playerId=ex.id;send(r);return;}if(r.phase!=='lobby')return socket.emit('errorMsg','Gra już się rozpoczęła.');if(r.players.length>=4)return socket.emit('errorMsg','Pokój jest pełny.');const id=tokenId||crypto.randomUUID();r.players.push({id,socketId:socket.id,name:String(name||'Gracz').trim().slice(0,18)||'Gracz',score:0,hand:[],decl:null,won:0,connected:true});socket.data.room=r.code;socket.data.playerId=id;send(r);});
 socket.on('startGame',()=>{const r=rooms.get(socket.data.room);if(!r)return;if(r.players[0].id!==socket.data.playerId)return socket.emit('errorMsg','Tylko gospodarz może rozpocząć.');if(r.players.length<2)return socket.emit('errorMsg','Potrzeba co najmniej 2 graczy.');dealRound(r);});
 socket.on('declare',n=>{const r=rooms.get(socket.data.room);if(!r)return;if(!legalDecl(r,socket.data.playerId,Number(n)))return socket.emit('errorMsg','Ta deklaracja jest niedozwolona.');findP(r,socket.data.playerId).decl=Number(n);nextDecl(r);});
 socket.on('play',card=>{const r=rooms.get(socket.data.room);if(!r)return;const e=play(r,socket.data.playerId,card);if(e)socket.emit('errorMsg',e);});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.room);if(!r)return;const p=findP(r,socket.data.playerId);if(p){p.connected=false;send(r);}});
});
const PORT=process.env.PORT||10000;httpServer.listen(PORT,'0.0.0.0',()=>console.log('Planowanie server listening on '+PORT));
