// Pure authoritative simulation, shared by the Node server and offline training.
export const WORLD = { width: 2600, height: 1800, cell: 48 };
export const BUILDINGS = {
 wall: { name: 'Rempart', wood: 20, stone: 15, gold: 0, hp: 600, radius: 23, range: 0 },
 arrow: { name: 'Arbalète', wood: 65, stone: 35, gold: 45, hp: 260, radius: 22, range: 290, damage: 26, rate: .65 },
 cannon: { name: 'Canon', wood: 60, stone: 90, gold: 140, hp: 380, radius: 23, range: 240, damage: 62, rate: 1.5 },
 frost: { name: 'Tour de givre', wood: 60, stone: 70, gold: 110, hp: 260, radius: 22, range: 260, damage: 9, rate: .8 },
 mine: { name: 'Mine', wood: 80, stone: 45, gold: 70, hp: 230, radius: 23, range: 0 },
 core: { name: 'Bastion', wood: 0, stone: 0, gold: 0, hp: 2400, radius: 42, range: 210, damage: 16, rate: .9 }
};
export const WAVES = {
 runners: { name: 'Meute', gold: 95, count: 5, hp: 105, speed: 100, damage: 13, radius: 11, income: .2 },
 brutes: { name: 'Colosses', gold: 180, count: 2, hp: 550, speed: 48, damage: 45, radius: 20, income: .3 },
 swarm: { name: 'Nuée', gold: 140, count: 12, hp: 42, speed: 125, damage: 7, radius: 7, income: .25 }
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const snap=n=>Math.floor(n/WORLD.cell)*WORLD.cell+WORLD.cell/2;
const home=side=>({x:side?2200:400,y:900});
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function createGame(seed=42){
 const g={version:1,time:0,phase:'lobby',winner:null,players:[],buildings:[],resources:[],mobs:[],effects:[],nextId:1,night:0};
 const random=rng(seed);
 // Mirrored layout: both camps have identical harvesting opportunities.
 for(let i=0;i<64;i++){
  let x=100+random()*1120,y=100+random()*1600;
  if(Math.hypot(x-400,y-900)<170)continue;
  for(let side=0;side<2;side++)g.resources.push({id:g.nextId++,x:side?2600-x:x,y,kind:i%3?'wood':'stone',amount:160,respawn:0,radius:i%3?26:22});
 }
 return g;
}
export function addPlayer(g,id,name,bot=false){
 if(g.phase!=='lobby'||g.players.length>=2||g.players.some(p=>p.id===id))return null;
 let side=g.players.length,h=home(side),p={id,name:String(name||'Explorateur').trim().slice(0,18)||'Explorateur',side,x:h.x,y:h.y+90,angle:0,hp:150,maxHp:150,wood:220,stone:170,gold:220,level:1,kills:0,income:2,respawn:0,attackCd:0,waveCd:0,healCd:0,ready:bot,connected:true,bot,input:{x:0,y:0,angle:0,attack:false},inputAge:0};
 g.players.push(p);
 g.buildings.push({id:g.nextId++,owner:id,side,kind:'core',...h,level:1,hp:2400,maxHp:2400,radius:42,cool:0});
 return p;
}
export function startGame(g){if(g.players.length===2&&g.players.every(p=>p.ready)){g.phase='playing';return true}return false}
function effect(g,kind,x,y,extra={}){g.effects.push({id:g.nextId++,kind,x,y,life:.3,...extra})}
function canPay(p,c){return ['wood','stone','gold'].every(k=>p[k]>=(c[k]||0))}
function pay(p,c){for(let k of ['wood','stone','gold'])p[k]-=c[k]||0}
export function upgradeCost(b){return{wood:Math.ceil(35*b.level),stone:Math.ceil(25*b.level),gold:Math.ceil((b.kind==='core'?140:65)*b.level)}}
export function buildError(g,p,kind,x,y){
 if(typeof kind!=='string')return'Bâtiment inconnu.';
 const d=BUILDINGS[kind];if(!Object.hasOwn(BUILDINGS,kind)||kind==='core')return'Bâtiment inconnu.';
 if(!finite(x)||!finite(y))return'Position invalide.';
 if(p.respawn>0)return'Attendez votre réapparition.';
 if(x<50||x>2550||y<50||y>1750)return'Hors de la carte.';
 if(distance(p,{x,y})>270)return'Approchez-vous pour construire.';
 if(distance(home(p.side),{x,y})>680)return'Construisez autour de votre bastion.';
 if(g.buildings.filter(b=>b.owner===p.id).length>=56)return'Limite de 55 constructions.';
 if(kind==='mine'&&g.buildings.filter(b=>b.owner===p.id&&b.kind==='mine').length>=8)return'Limite de 8 mines.';
 if(g.buildings.some(b=>distance(b,{x,y})<b.radius+d.radius+5)||g.resources.some(r=>r.amount>0&&distance(r,{x,y})<r.radius+d.radius+5)||g.players.some(q=>q.respawn===0&&distance(q,{x,y})<18+d.radius))return'Case occupée.';
 if(!canPay(p,d))return'Ressources insuffisantes.';
 return'';
}
export function command(g,id,a){
 const p=g.players.find(p=>p.id===id);
 if(!p||!a||typeof a!=='object')return'Joueur inconnu.';
 if(a.type==='ready'&&g.phase==='lobby'){p.ready=true;startGame(g);return''}
 if(g.phase!=='playing')return'La partie n’a pas commencé ou est terminée.';
 if(a.type==='input'){
  if(!finite(a.x)||!finite(a.y)||!finite(a.angle))return'Entrée invalide.';
  const len=Math.max(1,Math.hypot(a.x,a.y));p.input={x:a.x/len,y:a.y/len,angle:angleDiff(a.angle,0),attack:a.attack===true};p.inputAge=0;return'';
 }
 if(p.respawn>0)return'Vous réapparaissez bientôt.';
 if(a.type==='build'){
  if(!finite(a.x)||!finite(a.y))return'Position invalide.';
  let x=snap(a.x),y=snap(a.y),err=buildError(g,p,a.kind,x,y);if(err)return err;
  let d=BUILDINGS[a.kind];pay(p,d);g.buildings.push({id:g.nextId++,owner:id,side:p.side,kind:a.kind,x,y,radius:d.radius,level:1,hp:d.hp,maxHp:d.hp,cool:0});effect(g,'build',x,y);return'';
 }
 if(['upgrade','sell','repair'].includes(a.type)){
  const b=g.buildings.find(b=>b.id===a.id&&b.owner===id);if(!b)return'Ce bâtiment ne vous appartient pas.';
  if(distance(p,b)>280)return'Approchez-vous du bâtiment.';
  if(a.type==='sell'){if(b.kind==='core')return'Le bastion ne peut pas être vendu.';for(let k of ['wood','stone','gold'])p[k]+=Math.floor(BUILDINGS[b.kind][k]*.5);g.buildings=g.buildings.filter(x=>x!==b);return''}
  if(a.type==='repair'){if(b.hp>=b.maxHp)return'Bâtiment intact.';if(!canPay(p,{wood:20,stone:15,gold:25}))return'Ressources insuffisantes.';pay(p,{wood:20,stone:15,gold:25});b.hp=Math.min(b.maxHp,b.hp+b.maxHp*.4);return''}
  if(b.level>=5)return'Niveau maximum.';
  let core=g.buildings.find(b=>b.owner===id&&b.kind==='core');
  if(b.kind!=='core'&&b.level>=core.level)return'Améliorez d’abord votre bastion.';
  let cost=upgradeCost(b);if(!canPay(p,cost))return'Ressources insuffisantes.';
  pay(p,cost);b.level++;b.maxHp=Math.round(b.maxHp*1.4);b.hp=b.maxHp;effect(g,'build',b.x,b.y);return'';
 }
 if(a.type==='wave'){
  if(g.time<30)return'Trêve initiale : préparez votre base.';
  if(typeof a.kind!=='string')return'Vague inconnue.';
  const w=WAVES[a.kind];if(!Object.hasOwn(WAVES,a.kind))return'Vague inconnue.';
  if(p.waveCd>0)return'Portail en recharge.';
  if(p.gold<w.gold)return'Or insuffisant.';
  if(g.mobs.filter(m=>m.owner===id).length+w.count>70||g.mobs.length+w.count>180)return'Trop de créatures sur le terrain.';
  p.gold-=w.gold;p.waveCd=12;p.income+=w.income;spawnWave(g,p.id,1-p.side,a.kind,w.count);return'';
 }
 if(a.type==='heal'){if(p.healCd>0)return'Soin en recharge.';if(p.gold<45)return'Il faut 45 or.';p.gold-=45;p.hp=Math.min(p.maxHp,p.hp+90);p.healCd=25;effect(g,'heal',p.x,p.y);return''}
 if(a.type==='weapon'){if(p.level>=5)return'Arme au niveau maximum.';if(p.gold<100*p.level)return'Or insuffisant.';p.gold-=100*p.level;p.level++;return''}
 return'Action inconnue.';
}
function spawnWave(g,owner,target,kind,count){
 const w=WAVES[kind],scale=1+g.night*.12;
 for(let i=0;i<count;i++)g.mobs.push({id:g.nextId++,owner,target,kind,x:1300+(target?60:-60),y:720+(i%8)*48,radius:w.radius,hp:w.hp*scale,maxHp:w.hp*scale,damage:w.damage,speed:w.speed,cool:0,slow:0,age:0});
}
function blocked(g,p,x,y){
 if(x<20||x>2580||y<20||y>1780)return true;
 return g.buildings.some(b=>b.hp>0&&distance(b,{x,y})<b.radius+15)||g.resources.some(r=>r.amount>0&&distance(r,{x,y})<r.radius+15);
}
function killPlayer(g,p){
 p.hp=0;p.respawn=6;p.gold=Math.max(0,p.gold-35);p.input={x:0,y:0,angle:0,attack:false};effect(g,'death',p.x,p.y);
}
function attack(g,p){
 p.attackCd=.38;effect(g,'swing',p.x,p.y,{angle:p.angle,side:p.side});
 const inReach=e=>distance(p,e)<78+(e.radius||16)&&Math.abs(angleDiff(Math.atan2(e.y-p.y,e.x-p.x),p.angle))<.9;
 const mob=g.mobs.find(m=>m.target===p.side&&m.hp>0&&inReach(m));
 if(mob){mob.hp-=24+p.level*12;return}
 if(g.time>=30){
 const enemy=g.players.find(q=>q.side!==p.side&&q.respawn===0&&inReach(q));
 if(enemy){enemy.hp-=18+p.level*7;if(enemy.hp<=0){killPlayer(g,enemy);p.gold+=25;p.kills++}return}
 const b=g.buildings.find(b=>b.side!==p.side&&inReach(b));if(b){b.hp-=12+p.level*8;return}
 }
 const r=g.resources.find(r=>r.amount>0&&inReach(r));
 if(r){const amount=Math.min(r.amount,10+p.level*3);r.amount-=amount;p[r.kind]=Math.min(9999,p[r.kind]+amount);if(r.amount<=0)r.respawn=35;effect(g,'harvest',r.x,r.y,{resource:r.kind})}
}
function updateBot(g,p,dt){
 p.botCd=(p.botCd||0)-dt;if(p.botCd>0)return;p.botCd=1.4;
 const core=g.buildings.find(b=>b.owner===p.id&&b.kind==='core');
 if(!core)return;
 const enemy=g.mobs.find(m=>m.target===p.side&&distance(m,p)<150);
 const r=g.resources.filter(r=>r.amount>0&&distance(r,home(p.side))<600).sort((a,b)=>distance(a,p)-distance(b,p))[0];
 const target=enemy||r||core,dx=target.x-p.x,dy=target.y-p.y,l=Math.hypot(dx,dy);
 // Stop input briefly before each decision, then keep it fresh in tick().
 p.input={x:l>65?dx/(l||1):0,y:l>65?dy/(l||1):0,angle:Math.atan2(dy,dx),attack:l<110};
 if(p.gold>300&&core.level<3){if(distance(p,core)<280)command(g,p.id,{type:'upgrade',id:core.id})}
 const count=g.buildings.filter(b=>b.owner===p.id).length;
 if(count<16&&p.wood>80&&p.stone>60){
  const kinds=['arrow','mine','wall','cannon','frost'];
  const kind=kinds[count%kinds.length];
  for(let i=0;i<30;i++){
   const a=i*2.4+count,radius=150+Math.floor(i/10)*80,x=snap(core.x+Math.cos(a)*radius),y=snap(core.y+Math.sin(a)*radius);
   // Bot follows the same placement validations; temporarily walks toward the intended spot.
   if(distance(p,{x,y})<270&&!buildError(g,p,kind,x,y)){command(g,p.id,{type:'build',kind,x,y});break}
  }
 }
 if(g.time>45&&p.gold>180)command(g,p.id,{type:'wave',kind:g.night%2?'brutes':'runners'});
 if(p.hp<70)command(g,p.id,{type:'heal'});
}
export function tick(g,dt){
 if(g.phase!=='playing'||!finite(dt)||dt<=0)return;
 dt=Math.min(.1,dt);g.time+=dt;
 g.effects=g.effects.filter(e=>(e.life-=dt)>0);
 const night=Math.floor((g.time+45)/105);
 if(night>g.night){g.night=night;for(let side=0;side<2;side++)if(g.mobs.length<160)spawnWave(g,'wild',side,night%3===0?'brutes':'runners',Math.min(12,2+night))}
 for(let r of g.resources)if(r.amount<=0&&(r.respawn-=dt)<=0)r.amount=160;
 for(let p of g.players){
  p.attackCd-=dt;p.waveCd=Math.max(0,p.waveCd-dt);p.healCd=Math.max(0,p.healCd-dt);
  p.gold=Math.min(9999,p.gold+dt*(p.income+g.buildings.filter(b=>b.owner===p.id&&b.kind==='mine').reduce((n,b)=>n+b.level*1.8,0)));
  if(p.respawn>0){p.respawn=Math.max(0,p.respawn-dt);if(!p.respawn){Object.assign(p,home(p.side));for(let i=0;i<120;i++){let a=i*2.4,r=95+Math.floor(i/12)*35,x=home(p.side).x+Math.cos(a)*r,y=900+Math.sin(a)*r;if(!blocked(g,p,x,y)){p.x=x;p.y=y;break}}p.hp=p.maxHp}continue}
  if(p.bot)updateBot(g,p,dt);else p.inputAge+=dt;
  if(p.inputAge>.35)p.input={x:0,y:0,angle:p.angle,attack:false};
  p.slow=Math.max(0,(p.slow||0)-dt);p.angle=p.input.angle;const speed=p.slow>0?100:185,dx=p.input.x*speed*dt,dy=p.input.y*speed*dt;
  if(!blocked(g,p,p.x+dx,p.y))p.x+=dx;if(!blocked(g,p,p.x,p.y+dy))p.y+=dy;
  if(p.input.attack&&p.attackCd<=0)attack(g,p);
 }
 for(let b of g.buildings){
  if(b.hp<=0)continue;const d=BUILDINGS[b.kind];b.cool-=dt;if(!d.range||b.cool>0)continue;
  let candidates=g.mobs.filter(m=>m.target===b.side&&m.hp>0);
  if(g.time>30)candidates=candidates.concat(g.players.filter(p=>p.side!==b.side&&p.respawn===0));
  let target=null,near=Infinity;
  for(let m of candidates){let dist=distance(b,m);if(dist<d.range+(b.level-1)*22&&dist<near){target=m;near=dist}}
  if(target){
   const damage=d.damage*(1+(b.level-1)*.55);target.hp-=damage;
   if(b.kind==='frost')target.slow=2;
   if(b.kind==='cannon')for(let m of g.mobs)if(m!==target&&m.target===b.side&&distance(m,target)<78)m.hp-=damage*.6;
   effect(g,'shot',b.x,b.y,{tx:target.x,ty:target.y,weapon:b.kind,side:b.side});
   b.cool=d.rate;if(target.hp<=0&&g.players.includes(target))killPlayer(g,target);
  }
 }
 for(let m of g.mobs){
  if(m.hp<=0)continue;m.cool-=dt;m.slow=Math.max(0,m.slow-dt);m.age+=dt;
  let candidates=g.buildings.filter(b=>b.side===m.target&&b.hp>0);
  candidates=candidates.concat(g.players.filter(p=>p.side===m.target&&p.respawn===0&&distance(p,m)<140));
  let target=null,near=Infinity;
  for(let b of candidates){let d=distance(b,m)-(b.radius||16);if(d<near){target=b;near=d}}
  if(!target)continue;
  if(near<m.radius+8){if(m.cool<=0){target.hp-=m.damage;m.cool=1;if(target.hp<=0&&g.players.includes(target))killPlayer(g,target)}}
  else{let len=distance(target,m),v=Math.min(m.speed*(m.slow>0?.45:1)*dt,Math.max(0,near-m.radius-6));m.x+=(target.x-m.x)/(len||1)*v;m.y+=(target.y-m.y)/(len||1)*v}
 }
 g.mobs=g.mobs.filter(m=>{if(m.hp<=0){const p=g.players.find(p=>p.side===m.target);p.gold+=m.kind==='brutes'?15:5;p.kills++;effect(g,'death',m.x,m.y);return false}return m.age<100});
 const deadCores=g.buildings.filter(b=>b.kind==='core'&&b.hp<=0);if(deadCores.length){g.phase='ended';g.winner=deadCores.length===2?-1:1-deadCores[0].side}
 g.buildings=g.buildings.filter(b=>b.hp>0);
 if(g.time>=1200&&g.phase==='playing'){g.phase='ended';const cores=g.buildings.filter(b=>b.kind==='core');g.winner=cores[0].hp===cores[1].hp?-1:(cores[0].hp>cores[1].hp?cores[0].side:cores[1].side)}
}
export function snapshot(g){
 return {version:g.version,time:g.time,phase:g.phase,winner:g.winner,night:g.night,players:g.players.map(({input,inputAge,botCd,...p})=>p),buildings:g.buildings,resources:g.resources,mobs:g.mobs,effects:g.effects};
}
