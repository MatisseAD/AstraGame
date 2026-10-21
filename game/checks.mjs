import { createGame,addPlayer,startGame,command,tick,snapshot,buildError } from './engine.mjs';
const ok=(value,message='Assertion failed')=>{if(!value)throw new Error(message)};
function fixture(){
 const g=createGame(42);addPlayer(g,'a','Alice');addPlayer(g,'b','Bob');g.players.forEach(p=>p.ready=true);startGame(g);return g;
}
export const checks=[
 ['two players maximum',()=>{let g=createGame();ok(addPlayer(g,'a','A'));ok(addPlayer(g,'b','B'));ok(addPlayer(g,'c','C')===null)}],
 ['both players must be ready',()=>{let g=createGame();addPlayer(g,'a','A');addPlayer(g,'b','B');command(g,'a',{type:'ready'});ok(g.phase==='lobby');command(g,'b',{type:'ready'});ok(g.phase==='playing')}],
 ['input normalization prevents speed injection',()=>{let g=fixture();g.resources=[];let p=g.players[0];let x=p.x;command(g,'a',{type:'input',x:999,y:0,angle:0});tick(g,.1);ok(p.x-x<=18.51);ok(p.x>x)}],
 ['reject nonfinite coordinates',()=>{let g=fixture(),p=g.players[0],gold=p.gold;ok(command(g,'a',{type:'build',kind:'wall',x:NaN,y:100}));ok(p.gold===gold);ok(command(g,'a',{type:'input',x:Infinity,y:0,angle:0}))}],
 ['reject inherited catalog keys',()=>{let g=fixture();g.time=31;ok(command(g,'a',{type:'wave',kind:'__proto__'}));ok(command(g,'a',{type:'build',kind:'constructor',x:500,y:1000}))}],
 ['building costs are server controlled',()=>{let g=fixture();g.resources=[];let p=g.players[0],w=p.wood,s=p.stone;ok(!command(g,'a',{type:'build',kind:'wall',x:520,y:1000,wood:0}));ok(p.wood===w-20&&p.stone===s-15);ok(g.buildings.length===3)}],
 ['building overlap is rejected without payment',()=>{let g=fixture();g.resources=[];command(g,'a',{type:'build',kind:'wall',x:520,y:1000});let p=g.players[0],w=p.wood;ok(command(g,'a',{type:'build',kind:'wall',x:520,y:1000}));ok(p.wood===w)}],
 ['enemy building cannot be sold or upgraded',()=>{let g=fixture(),id=g.buildings[1].id;ok(command(g,'a',{type:'sell',id}));ok(command(g,'a',{type:'upgrade',id}));ok(g.buildings.length===2)}],
 ['cannot build remotely',()=>{let g=fixture();ok(buildError(g,g.players[0],'wall',900,500))}],
 ['initial truce blocks waves',()=>{let g=fixture(),p=g.players[0];ok(command(g,'a',{type:'wave',kind:'runners'}));ok(p.gold===220)}],
 ['wave cooldown and payment are enforced',()=>{let g=fixture();g.time=31;ok(!command(g,'a',{type:'wave',kind:'runners'}));ok(g.mobs.length===5);ok(g.players[0].gold===125);ok(command(g,'a',{type:'wave',kind:'runners'}));ok(g.mobs.length===5)}],
 ['insufficient funds cannot produce a wave',()=>{let g=fixture();g.time=31;g.players[0].gold=0;ok(command(g,'a',{type:'wave',kind:'brutes'}));ok(!g.mobs.length)}],
 ['stale input stops movement after 350ms',()=>{let g=fixture();g.resources=[];command(g,'a',{type:'input',x:1,y:0,angle:0});for(let i=0;i<8;i++)tick(g,.05);let x=g.players[0].x;for(let i=0;i<8;i++)tick(g,.05);ok(g.players[0].x===x)}],
 ['resource harvesting produces material',()=>{let g=fixture(),p=g.players[0];g.resources=[{id:999,x:p.x+55,y:p.y,kind:'wood',amount:160,radius:26}];let wood=p.wood;command(g,'a',{type:'input',x:0,y:0,angle:0,attack:true});tick(g,.05);ok(p.wood>wood)}],
 ['dead resource respawns',()=>{let g=fixture();g.resources=[{id:999,x:150,y:150,kind:'wood',amount:0,respawn:.05,radius:26}];tick(g,.1);ok(g.resources[0].amount===160)}],
 ['destroyed core ends match and freezes economy',()=>{let g=fixture();g.buildings[1].hp=0;tick(g,.05);ok(g.phase==='ended'&&g.winner===0);let gold=g.players[0].gold;tick(g,.1);ok(g.players[0].gold===gold)}],
 ['simultaneous destruction is a draw',()=>{let g=fixture();g.buildings.forEach(b=>b.hp=0);tick(g,.05);ok(g.winner===-1)}],
 ['snapshot does not expose control input',()=>{let g=fixture();ok(!Object.hasOwn(snapshot(g).players[0],'input'))}],
 ['weapon catalog has five independent progression paths',()=>{
  let g=fixture(),p=g.players[0];
  ok(Object.keys(p.weaponLevels).length===5);
  ok(p.weapon==='blade'&&p.weaponLevels.blade===1);
  ok(command(g,'a',{type:'equip',kind:'bow'})); // initially locked
  const gold=p.gold;ok(!command(g,'a',{type:'unlock',kind:'bow'}));
  ok(p.gold===gold-125&&p.weapon==='bow'&&p.weaponLevels.bow===1);
  ok(!command(g,'a',{type:'equip',kind:'blade'}));
  ok(p.weapon==='blade'&&p.weaponLevels.blade===1);
  ok(!command(g,'a',{type:'equip',kind:'bow'}));ok(p.weaponLevels.bow===1);
 }],
 ['weapon upgrades deduct gold and are capped at level 5',()=>{
  let g=fixture(),p=g.players[0];p.gold=3000;
  for(let i=0;i<4;i++)ok(!command(g,'a',{type:'weapon'}));
  ok(p.level===5&&p.weaponLevels.blade===5);
  const gold=p.gold;ok(command(g,'a',{type:'weapon'}));ok(p.gold===gold);
 }],
 ['weapon actions cannot unlock prototype keys or bypass prices',()=>{
  let g=fixture(),p=g.players[0];p.gold=0;
  for(const kind of ['__proto__','constructor','nonexistent'])ok(command(g,'a',{type:'unlock',kind}));
  ok(command(g,'a',{type:'unlock',kind:'staff'}));
  ok(command(g,'a',{type:'equip',kind:'staff'}));
  ok(p.weapon==='blade'&&p.weaponLevels.staff===0);
 }],
 ['bow attacks distant mobs whereas blade cannot',()=>{
  let g=fixture(),p=g.players[0];g.resources=[];g.buildings=[];
  const mob={id:9999,owner:'wild',target:0,kind:'brutes',x:p.x+215,y:p.y,radius:12,hp:500,maxHp:500,damage:0,speed:0,cool:0,slow:0,age:0};
  g.mobs=[mob];command(g,'a',{type:'input',x:0,y:0,angle:0,attack:true});tick(g,.05);
  ok(mob.hp===500,'blade should not reach remote mob');
  p.weapon='bow';p.weaponLevels.bow=1;p.attackCd=0;tick(g,.05);
  ok(mob.hp<500,'bow should hit target at range');
 }],
 ['hammer hits multiple mobs within a cone',()=>{
  let g=fixture(),p=g.players[0];g.resources=[];g.buildings=[];
  g.mobs=[60,75].map((dx,i)=>({id:10001+i,owner:'wild',target:0,kind:'brutes',x:p.x+dx,y:p.y,radius:12,hp:500,maxHp:500,damage:0,speed:0,cool:0,slow:0,age:0}));
  p.weapon='hammer';p.weaponLevels.hammer=1;
  command(g,'a',{type:'input',x:0,y:0,angle:0,attack:true});tick(g,.05);
  ok(g.mobs.every(m=>m.hp<500),'hammer must damage both mobs');
 }],
 ['full simulation remains finite',()=>{let g=fixture();g.players[1].bot=true;for(let i=0;i<6000&&g.phase==='playing';i++)tick(g,.05);ok(g.time>60);for(let p of g.players)for(let k of ['x','y','gold','wood','stone','hp'])ok(Number.isFinite(p[k]),k);ok(g.mobs.length<=180)}]
];
