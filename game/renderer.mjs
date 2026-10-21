import { WORLD, BUILDINGS, WAVES, snap, buildError, upgradeCost } from './engine.mjs';
import { createArt } from './art.mjs';
const TEAM=['#87e6c1','#f2a18d'];
export function createRenderer(canvas){
 const c=canvas.getContext('2d'),art=createArt(c),camera={x:400,y:900,zoom:1},visual=new Map();let width=1000,height=700;
 function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);c.setTransform(dpr,0,0,dpr,0,0)}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 function worldAt(clientX,clientY){const r=canvas.getBoundingClientRect();return{x:(clientX-r.left-width/2)/camera.zoom+camera.x,y:(clientY-r.top-height/2)/camera.zoom+camera.y}}
 function disc(x,y,r,color,stroke){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke()}}
 function bar(e,r){if(e.hp>=e.maxHp)return;c.fillStyle='#12221e';c.fillRect(e.x-r,e.y-r-15,r*2,5);c.fillStyle=e.hp/e.maxHp>.35?'#b7e792':'#f6857d';c.fillRect(e.x-r,e.y-r-15,r*2*Math.max(0,e.hp/e.maxHp),5)}
 function diamond(x,y,size,color){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle=color;c.fillRect(-size/2,-size/2,size,size);c.restore()}
 function text(s,x,y,color='#eef4e2',size=12){c.font='600 '+size+'px system-ui';c.textAlign='center';c.fillStyle=color;c.fillText(s,x,y)}
 function draw(g,id,opts,dt){
 if(!g)return;const p=g.players.find(p=>p.id===id)||g.players[0];if(!p)return;
 let targetZoom=opts.zoom||1;camera.zoom+=(targetZoom-camera.zoom)*Math.min(1,dt*8);
 camera.x+=(p.x-camera.x)*Math.min(1,dt*10);camera.y+=(p.y-camera.y)*Math.min(1,dt*10);
 c.clearRect(0,0,width,height);c.fillStyle='#15231f';c.fillRect(0,0,width,height);
 c.save();c.translate(width/2,height/2);c.scale(camera.zoom,camera.zoom);c.translate(-camera.x,-camera.y);
 // Original locally served SVG texture atlas is used to render the arena.
 let left=camera.x-width/(2*camera.zoom)-80,right=camera.x+width/(2*camera.zoom)+80,top=camera.y-height/(2*camera.zoom)-80,bottom=camera.y+height/(2*camera.zoom)+80;
 art.ground(left,top,right,bottom,g.night);
 for(let side=0;side<2;side++){let x=side?2200:400;c.strokeStyle=TEAM[side]+'25';c.lineWidth=2;c.beginPath();c.arc(x,900,680,0,Math.PI*2);c.stroke()}
 const visible=e=>e.x>left&&e.x<right&&e.y>top&&e.y<bottom;
 for(const resource of g.resources)if(visible(resource))art.resource(resource);
 const selected=g.buildings.find(b=>b.id===opts.selected);
 if(selected){let range=BUILDINGS[selected.kind].range+22*(selected.level-1);if(range)disc(selected.x,selected.y,range,TEAM[selected.side]+'0a',TEAM[selected.side]+'33')}
 for(const b of g.buildings){if(!visible(b))continue;art.building(b,opts.selected===b.id,g.time);bar(b,b.radius)}
 const entities=[...g.mobs.map(m=>({...m,entity:'mob'})),...g.players.filter(p=>!p.respawn).map(p=>({...p,entity:'hero'}))].sort((a,b)=>a.y-b.y);
 const live=new Set();
 for(let e of entities){
  live.add(e.id);let pos=visual.get(e.id);
  if(!pos||Math.hypot(pos.x-e.x,pos.y-e.y)>300)pos={x:e.x,y:e.y};
  const k=Math.min(1,dt*18);pos.x+=(e.x-pos.x)*k;pos.y+=(e.y-pos.y)*k;visual.set(e.id,pos);e.x=pos.x;e.y=pos.y;
  if(!visible(e))continue;const hero=e.entity==='hero',r=hero?18:e.radius;disc(e.x+4,e.y+8,r+2,'#11201a55');
  if(hero){
   art.hero(e,e.id===id,g.time);
   text(e.name,e.x,e.y-37,e.id===id?'#efffe6':'#ecd9c6',11);bar(e,23)
  }else{let color=e.kind==='brutes'?'#b69562':e.kind==='swarm'?'#ba9ace':'#b3cc79';disc(e.x,e.y,r,color,'#394831');c.fillStyle='#293427';c.fillRect(e.x-4,e.y-4,3,3);c.fillRect(e.x+3,e.y-4,3,3);if(e.slow>0)disc(e.x,e.y,r+4,'#99efff20','#a1ecf9');bar(e,r)}
 }
 for(let key of visual.keys())if(!live.has(key))visual.delete(key);
 for(let e of g.effects||[]){
  if(e.kind==='shot'){c.strokeStyle=['frost','staff'].includes(e.weapon)?'#b2eeff':e.weapon==='cannon'?'#ffd187':e.weapon==='bow'?'#f6eab9':TEAM[e.side];c.lineWidth=['cannon','staff'].includes(e.weapon)?4:2;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.stroke();disc(e.tx,e.ty,5,'#f5e7b4')}
  else if(e.kind==='swing'){c.strokeStyle='#f6e8af88';c.lineWidth=5;c.beginPath();c.arc(e.x,e.y,e.range*.65||52,e.angle-.6,e.angle+.6);c.stroke()}
  else{const radius=10+(1-e.life/.3)*22;c.strokeStyle=e.kind==='heal'?'#b4ffbe':'#e2d79b';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,radius,0,Math.PI*2);c.stroke()}
 }
 if(opts.build&&opts.pointer&&g.phase==='playing'){
  const x=snap(opts.pointer.x),y=snap(opts.pointer.y),ok=!buildError(g,p,opts.build,x,y),d=BUILDINGS[opts.build];
  c.fillStyle=ok?'#b9f4c555':'#f69b9755';c.strokeStyle=ok?'#b9f4c5':'#f69b97';c.lineWidth=2;c.fillRect(x-23,y-23,46,46);c.strokeRect(x-23,y-23,46,46);
  if(d.range)disc(x,y,d.range,'#baf4ce08','#baf4ce33')
 }
 c.restore();
 const cycle=g.time%105;if(cycle>=60){c.fillStyle='#05172e44';c.fillRect(0,0,width,height)}
 // Minimap: all players and bases are intentionally visible.
 let mx=width-174,my=height-136,mw=156,mh=108;
 c.fillStyle='#11221ee8';c.beginPath();c.roundRect(mx-8,my-8,mw+16,mh+16,10);c.fill();c.strokeStyle='#98bca633';c.stroke();
 c.fillStyle='#34523c';c.fillRect(mx,my,mw,mh);
 const px=x=>mx+x/2600*mw,py=y=>my+y/1800*mh;
 for(let b of g.buildings){c.fillStyle=TEAM[b.side];c.fillRect(px(b.x)-2,py(b.y)-2,4,4)}
 for(let m of g.mobs){c.fillStyle='#d6a46e';c.fillRect(px(m.x),py(m.y),2,2)}
 for(let q of g.players)disc(px(q.x),py(q.y),3,TEAM[q.side]);
 c.strokeStyle='#ffffff80';c.lineWidth=1;c.strokeRect(px(camera.x-width/(2*camera.zoom)),py(camera.y-height/(2*camera.zoom)),width/camera.zoom/2600*mw,height/camera.zoom/1800*mh);
 }
 return {draw,worldAt,reset:(p)=>{camera.x=p.x;camera.y=p.y;visual.clear()},destroy:()=>observer.disconnect()};
}
