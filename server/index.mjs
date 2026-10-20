import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createGame, addPlayer, command, tick, snapshot } from '../game/engine.mjs';

const port = Number(process.env.PORT || 3001);
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s=>s.trim()).filter(Boolean);
if(process.env.NODE_ENV==='production' && (!process.env.ALLOWED_ORIGINS || origins.includes('*'))) throw new Error('Set ALLOWED_ORIGINS to exact frontend origins in production.');
const rooms = new Map();
const server = http.createServer((req,res)=>{
 res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(req.url==='/health'?{ok:true,rooms:rooms.size,protocol:1}:{error:'Not found'}));
});
const wss = new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/ws'||!origins.includes(req.headers.origin)||wss.clients.size>=200){
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
 }
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<512000)ws.send(JSON.stringify(data))};
const error=(ws,message)=>send(ws,{type:'error',message});
function lobby(room){return{type:'state',code:room.code,state:snapshot(room.game)}}
wss.on('connection',ws=>{
 ws.alive=true;ws.on('pong',()=>ws.alive=true);
 let room=null,seat=null,windowStart=Date.now(),messages=0,actions=0;
 const handshake=setTimeout(()=>{if(!seat)ws.close(1008,'Handshake required')},8000);
 ws.on('message',raw=>{
  if(Date.now()-windowStart>=1000){windowStart=Date.now();messages=0;actions=0}
  if(++messages>50){ws.close(1008,'Rate limit');return}
  let data;try{data=JSON.parse(raw.toString())}catch{error(ws,'Message invalide.');return}
  if(!data||typeof data!=='object'||Array.isArray(data))return;
  if(!seat){
   if(data.protocol!==1){error(ws,'Version incompatible. Actualisez la page.');return}
   if(data.type==='resume'){
    room=rooms.get((typeof data.code==='string'?data.code:'').toUpperCase());seat=room?.seats.find(s=>s.token===data.token);
    if(!seat){room=null;error(ws,'Session expirée ou serveur redémarré. Revenez au menu.');return}
    const previous=seat.ws;seat.ws=ws;if(previous&&previous!==ws)previous.close(4001,'Session resumed elsewhere');
   }else if(data.type==='create'||data.type==='join'){
    if(typeof data.name!=='string'||!data.name.trim()||data.name.length>18){error(ws,'Choisissez un pseudo de 1 à 18 caractères.');return}
    if(data.type==='create'){
     if(rooms.size>=50){error(ws,'Serveur complet. Réessayez plus tard.');return}
     let code;do{code=randomBytes(5).toString('hex').toUpperCase()}while(rooms.has(code));
     room={code,game:createGame(randomBytes(4).readUInt32LE()),seats:[],created:Date.now(),emptySince:0,ageTicks:0};
     rooms.set(code,room);
    }else{
     room=rooms.get((typeof data.code==='string'?data.code:'').trim().toUpperCase());
     if(!room||room.seats.length>=2||room.game.phase!=='lobby'){room=null;error(ws,'Salon introuvable, complet ou déjà commencé.');return}
    }
    const id=randomBytes(12).toString('hex'),player=addPlayer(room.game,id,data.name);
    if(!player){error(ws,'Impossible de rejoindre ce salon.');room=null;return}
    seat={id,token:randomBytes(32).toString('hex'),ws,lastSeen:Date.now()};room.seats.push(seat);
   }else{error(ws,'Créez ou rejoignez un salon.');return}
   clearTimeout(handshake);seat.lastSeen=Date.now();room.emptySince=0;
   room.game.players.find(p=>p.id===seat.id).connected=true;
   send(ws,{type:'welcome',id:seat.id,token:seat.token,code:room.code,protocol:1});
   for(const s of room.seats)if(s.ws)send(s.ws,lobby(room));return;
  }
  if(seat.ws!==ws)return;
  seat.lastSeen=Date.now();
  if(data.type==='ping'){send(ws,{type:'pong',sent:data.sent});return}
  if(data.type!=='action')return;
  if(data.action?.type!=='input'&&++actions>6){error(ws,'Trop d’actions.');return}
  if(data.action?.type==='ready'&&!room.game.players.every(p=>p.connected)){error(ws,'Attendez la connexion des deux joueurs.');return}
  const err=command(room.game,seat.id,data.action);if(err)error(ws,err);
 });
 ws.on('error',()=>{});
 ws.on('close',()=>{
  clearTimeout(handshake);
  if(seat&&seat.ws===ws){seat.ws=null;seat.lastSeen=Date.now();const p=room.game.players.find(p=>p.id===seat.id);p.connected=false;p.input={x:0,y:0,angle:p.angle,attack:false}}
 });
});
let ticks=0;
const loop=setInterval(()=>{
 for(const [code,room] of rooms){
  const now=Date.now(),connected=room.seats.filter(s=>s.ws&&s.ws.readyState===WebSocket.OPEN);
  if(!connected.length){room.emptySince ||= now;if(now-room.emptySince>120000){rooms.delete(code);continue}}
  else room.emptySince=0;
  if(room.game.phase==='playing'){
   for(const seat of room.seats)if(!seat.ws&&now-seat.lastSeen>60000){room.game.phase='ended';room.game.winner=1-room.game.players.find(p=>p.id===seat.id).side}
   tick(room.game,.05);
  }
  if(++room.ageTicks>36000){for(const seat of room.seats)seat.ws?.close(1000,'Room expired');rooms.delete(code);continue}
  if(ticks%2===0){const state=lobby(room);for(const seat of connected)send(seat.ws,state)}
 }
 ticks++;
},50);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping()}},15000);
server.listen(port,()=>console.log('AstraGame server listening on port '+port));
function stop(){clearInterval(loop);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1001,'Server restarting');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2000).unref()}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
