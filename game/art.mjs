// AstraGame original vector sprites. All shapes and textures are drawn locally.
const PALETTES=[
 {edge:'#a8f6ce',dark:'#234e43',roof:'#398975',light:'#d9fff0'},
 {edge:'#ffc6a8',dark:'#663f40',roof:'#ad665a',light:'#ffe8cf'}
];
const TAU=Math.PI*2;
export function createArt(c){
 const images={};
 for(const name of ['grass','dirt','stone','wood','metal']){
  const img=new Image();images[name]=img;img.src='/assets/'+name+'.svg';
 }
 const patterns={};
 function pattern(name){const img=images[name];if(!img?.complete||!img.naturalWidth)return null;return patterns[name] ||= c.createPattern(img,'repeat')}
 function rect(x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
 function textured(x,y,w,h,name,fallback,r=0){
  c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.clip();c.fillStyle=pattern(name)||fallback;c.fillRect(x,y,w,h);c.fillStyle=fallback+'33';c.fillRect(x,y,w,h);c.restore();
 }
 function circle(x,y,r,color,line){c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();if(line){c.strokeStyle=line;c.lineWidth=2;c.stroke()}}
 function poly(points,color,stroke,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke()}}
 function line(points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke()}
 function gem(x,y,s,color,edge='#efffff'){poly([[x,y-s],[x+s*.78,y],[x,y+s],[x-s*.78,y]],color,edge,1.2);line([[x-s*.55,y],[x,y-s*.7],[x+s*.25,y]],'#ffffff8c',1.1)}
 function metalStuds(radius,level){for(let i=0;i<level+3;i++){const a=i*TAU/(level+3);circle(Math.cos(a)*radius,Math.sin(a)*radius,2.5,'#e6d1a0','#463f3b')}}
 function glyphs(radius,count,color){for(let i=0;i<count;i++){const a=i*TAU/count;c.save();c.rotate(a);gem(0,-radius,3.5,color);c.restore()}}
 function roof(w,h,col){poly([[-w/2,-h/2],[-w/2-3,0],[0,h/2+5],[w/2+3,0],[w/2,-h/2]],col,'#192d2d',2);line([[-w/2+4,-h/2+5],[0,h/2]],'#ffffff37',1.5)}
 function tower(x,y,size,p,level){
  c.save();c.translate(x,y);
  circle(2,4,size*.9,'#0c1a1d66');
  textured(-size*.65,-size*.65,size*1.3,size*1.3,'stone','#53625c',4);
  rect(-size*.5,-size*.6,size,5,p.edge,2);
  rect(-size*.5,size*.25,size,4,'#172c2b',1);
  poly([[-size*.75,-size*.55],[0,-size*.95],[size*.75,-size*.55]],p.roof,'#192b30');
  if(level>=3)gem(0,-size*.45,3,p.light);
  c.restore();
 }
 function grassDetail(x,y,seed){const t=Math.sin(seed*127.1+13.7)*43758.5453,f=t-Math.floor(t);if(f<.65){
  line([[x-2,y+3],[x-3,y-2],[x-5,y-4]],'#d2df8036',1);
  line([[x,y+3],[x+1,y-5]],'#0d412c5a',1.2);
  if(f<.1)circle(x+4,y-2,1.5,'#eac9a36e');
 }}
 function ground(left,top,right,bottom,night=0){
  const l=Math.max(0,left),t=Math.max(0,top),r=Math.min(2600,right),b=Math.min(1800,bottom);
  rect(0,0,2600,1800,'#314e39');
  c.save();c.beginPath();c.rect(0,0,2600,1800);c.clip();
  const grass=pattern('grass');if(grass){c.fillStyle=grass;c.fillRect(l,t,r-l,b-t)}
  const dirt=pattern('dirt');
  if(dirt){c.fillStyle=dirt;c.globalAlpha=.21;c.fillRect(1254,t,92,b-t);c.globalAlpha=1}
  rect(1262,t,76,b-t,'#917a4e27');
  for(let x=Math.floor(l/64)*64;x<r;x+=64)for(let y=Math.floor(t/64)*64;y<b;y+=64){
   const h=Math.abs(Math.sin(x*.067+y*.173)*19327.123);grassDetail(x+8+(h%38),y+12+((h*3)%37),x*91+y*31);
   if(h%11<.7)circle(x+40,y+13,3,'#d1d58c1c');
  }
  c.strokeStyle='#e9d59a58';c.lineWidth=2;c.setLineDash([8,18]);c.beginPath();c.moveTo(1300,t);c.lineTo(1300,b);c.stroke();c.setLineDash([]);
  c.restore();
 }
 function resource(r){
  if(r.amount<=0){circle(r.x,r.y,8,'#675039','#2c342a');return}
  c.save();c.translate(r.x,r.y);
  c.save();c.scale(1,.5);circle(5,33,r.radius+8,'#0b1d1777');c.restore();
  if(r.kind==='wood'){
   textured(-7,-8,14,37,'wood','#765438',2);
   line([[-4,16],[-11,7],[-14,-2]],'#513929',4);
   line([[4,6],[13,-3]],'#513929',4);
   const leaves=[[-14,0,18],[14,-5,17],[-5,-18,21],[12,-22,16],[-16,-18,16],[0,7,17]];
   for(const [x,y,s] of leaves){circle(x,y,s,'#204b37','#143e30');circle(x-4,y-5,s*.75,'#3e7850');circle(x+3,y-2,s*.4,'#5f9b60');}
   for(let i=0;i<8;i++){const x=Math.sin(i*7.1)*19,y=Math.cos(i*4.7)*15-12;circle(x,y,2,'#b1c97d74')}
  }else{
   poly([[-25,8],[-23,-9],[-9,-21],[9,-23],[24,-5],[18,17],[-5,22]],'#4d635e','#253d39',3);
   poly([[-21,5],[-19,-9],[-6,-19],[2,2],[-7,18]],'#879b92');
   poly([[-4,-19],[10,-21],[21,-5],[8,7]],'#a3b3a5');
   poly([[9,8],[20,-4],[17,14],[-4,19]],'#617970');
   line([[-18,-8],[-9,-14],[-7,-5]],'#dce1c380',2);
   if(r.amount<100)line([[-2,-5],[8,3],[4,14]],'#354942',2);
  }
  c.restore();
 }
 function building(b,selected,time){
  const p=PALETTES[b.side],lv=Math.min(5,Math.max(1,b.level|0)),r=b.radius;
  c.save();c.translate(b.x,b.y);
  c.save();c.scale(1,.55);circle(5,19,r+9,'#071c1b99');c.restore();
  if(selected){circle(0,0,r+10,'#ffe6a322','#ffe0a2');}
  if(b.kind==='wall'){
   textured(-r,-r,r*2,r*2,'stone','#728078',5);
   rect(-r,-r,r*2,9,lv>=3?'#748e87':'#465c57',3);
   rect(-r,r-7,r*2,7,'#303d3d',2);
   for(let j=0;j<lv+2;j++){
    const x=-r+(j+.5)*r*2/(lv+2);
    rect(x-3,-r-4,7,11,lv>=4?'#d2c7a0':'#bcc8b4',1);
    if(lv>=2)rect(x-3,r-4,6,5,'#3e6256',1);
   }
   if(lv>=3)for(let k of [-1,1])poly([[k*(r+2),-r/2],[k*(r+12),0],[k*(r+2),r/2]],'#afbca6','#4d5d59',2);
   if(lv>=4){line([[-r+4,0],[r-4,0]],'#d6c692',3);gem(0,0,7,p.edge)}
   if(lv>=5){c.shadowColor=p.edge;c.shadowBlur=12;glyphs(r+3,6,p.edge);c.shadowBlur=0}
  }
  else{
   textured(-r,-r,r*2,r*2,'stone','#465b58',7);
   c.strokeStyle='#152d30';c.lineWidth=3;c.strokeRect(-r+4,-r+4,r*2-8,r*2-8);
   if(lv>=3){rect(-r,-r,7,r*2,'#c4aa81',2);rect(r-7,-r,7,r*2,'#c4aa81',2)}
   if(b.kind==='core'){
    const s=lv>=4?4:lv>=2?3:2;
    for(let i=0;i<s;i++){const a=(i/s)*TAU+Math.PI/4;tower(Math.cos(a)*(r-11),Math.sin(a)*(r-11),lv>=3?17:14,p,lv)}
    circle(0,0,24+lv,'#172c31',p.edge);
    for(let j=0;j<lv+2;j++){const a=j*TAU/(lv+2)+time*.15;circle(Math.cos(a)*20,Math.sin(a)*20,2.4,p.edge)}
    c.save();c.shadowColor=p.edge;c.shadowBlur=lv>=4?23:9;gem(0,-2,17+lv*2,p.edge,p.light);c.restore();
    if(lv>=4){glyphs(32,lv+2,'#f0d99c');}
    if(lv>=5){poly([[-14,-28],[-9,-40],[0,-29],[9,-40],[14,-28]],'#e9cb79','#fff6ce');gem(0,-39,5,'#fff1ae')}
   }else if(b.kind==='arrow'){
    textured(-15,-17,30,34,'wood','#846947',4);
    roof(32,30,p.roof);
    rect(-5,-22,10,45,'#2f3732',3);
    const bows=lv>=4?3:lv>=2?2:1;
    for(let i=0;i<bows;i++){const y=(i-(bows-1)/2)*12;line([[9,y-12],[23,y],[9,y+12]],lv>=3?'#dfd6a4':'#d5ae76',3);line([[8,y-12],[8,y+12]],'#e8edcd',1)}
    rect(-5,-4,35,8,'#3a493f',2);
    if(lv>=3)metalStuds(16,lv);
    if(lv>=4){poly([[-19,-22],[-27,-14],[-17,-9]],p.edge,'#1d3937');}
    if(lv>=5){c.shadowColor=p.edge;c.shadowBlur=13;gem(26,0,6,'#e6feaa');c.shadowBlur=0}
   }else if(b.kind==='cannon'){
    circle(0,0,18+Math.min(lv,3),'#758b82','#293f40');circle(0,0,11,'#202e34','#bdaf8c');
    for(let i=0;i<(lv>=4?3:lv>=2?2:1);i++){
     const x=(i-((lv>=4?3:lv>=2?2:1)-1)/2)*11;
     rect(x-5,-29,10,32,lv>=3?'#aeb8a7':'#43585b',3);
     rect(x-6,-29,12,8,'#1b2d33',2);circle(x,-29,3,'#0e1a20','#d6c9aa');
    }
    if(lv>=3)for(let i=0;i<4;i++)gem(Math.cos(i*Math.PI/2)*16,Math.sin(i*Math.PI/2)*16,3,'#e4c587');
    if(lv>=5){circle(0,6,6,'#ffa95b','#fff0a3');c.shadowColor='#ffa75b';c.shadowBlur=14;circle(0,6,4,'#ffd18f');c.shadowBlur=0}
   }else if(b.kind==='frost'){
    circle(0,0,17,'#315e70','#9ad4dc');circle(0,0,11,'#235263');
    const count=lv+2;
    for(let i=0;i<count;i++){const a=i*TAU/count+time*.08;c.save();c.rotate(a);gem(0,-18,lv>=3?9:7,'#77d7e7','#dcffff');c.restore()}
    c.save();c.shadowColor='#86f1fb';c.shadowBlur=lv>=4?22:7;gem(0,-5,12+lv*2,'#b6f7ff');c.restore();
    if(lv>=4)glyphs(24,count,'#e5ffff');
    if(lv>=5){c.strokeStyle='#aefaff99';c.lineWidth=2;c.beginPath();c.arc(0,0,28,0,TAU);c.stroke()}
   }else if(b.kind==='mine'){
    textured(-18,-8,36,29,'wood','#715438',3);
    roof(43,25,lv>=3?'#968665':'#7a634d');
    rect(-11,1,22,19,'#1c2628',2);rect(-5,5,10,15,'#e7c16f',2);
    for(let i=0;i<lv;i++){const x=-13+i*7;circle(x,14,2.5,'#d9c58a')}
    if(lv>=2){line([[15,-11],[23,-29],[29,-29]],'#d6c18b',4);circle(23,-29,4,'#d4b26f')}
    if(lv>=3){rect(-21,-25,8,19,'#5b6b64',2);rect(-22,-26,10,4,'#c5a681',1)}
    if(lv>=4){gem(0,-4,9,'#f6d36f','#fff1b9');}
    if(lv>=5){c.shadowColor='#ffe5a2';c.shadowBlur=18;circle(0,-4,6,'#fff0b0');c.shadowBlur=0}
   }
  }
  if(lv>1){rect(-r,-r-13,lv*7+7,10,'#1b2d2dcc',4);for(let i=0;i<lv;i++)gem(-r+7+i*7,-r-8,2.7,i===4?'#ffe9b7':'#b6d3c1')}
  c.restore();
 }
 function hero(e,isMe,time){
  const p=PALETTES[e.side],weapon=e.weapon||'blade',level=e.level||1;
  c.save();c.translate(e.x,e.y);
  if(isMe){c.strokeStyle=p.edge+'77';c.lineWidth=2;c.beginPath();c.arc(0,0,24+Math.sin(time*3)*1.5,0,TAU);c.stroke()}
  c.save();c.rotate(e.angle||0);
  circle(3,7,20,'#13261e88');
  for(const y of [-12,12]){circle(-7,y,7,'#b9a07c','#584b3e');circle(9,y,6,'#705946','#2d3435')}
  circle(0,0,18,p.roof,p.dark);poly([[-13,-10],[3,-13],[13,0],[3,13],[-13,10]],p.dark,p.edge,2);
  circle(-5,-6,6,p.light);
  const metal=level>=4?'#f8e8ae':level>=2?'#e2dbbd':'#aeb9bc';
  const glow=level>=5?'#d8f6ff':p.edge;
  if(weapon==='blade'){rect(15,-4,13,8,'#71543e',2);poly([[25,-5],[45,-4],[54,0],[45,5],[25,5]],metal,'#4b625d');if(level>=3)gem(35,0,4,glow)}
  if(weapon==='spear'){line([[9,0],[58,0]],'#926b45',4);poly([[56,-8],[75,0],[56,8]],metal,'#47656c');if(level>=3)gem(56,0,4,glow)}
  if(weapon==='hammer'){line([[9,0],[43,0]],'#7d6648',6);rect(38,-14,19,28,metal,3);rect(38,-14,19,5,'#687d7e',1);if(level>=4)gem(48,0,6,glow)}
  if(weapon==='bow'){line([[20,-16],[37,0],[20,16]],'#d9bd8a',3);line([[20,-16],[20,16]],'#edf4d5',1.5);line([[15,0],[52,0]],metal,2);poly([[52,-4],[60,0],[52,4]],glow)}
  if(weapon==='staff'){line([[10,0],[52,0]],'#bba67e',5);c.save();c.shadowColor='#8fe6ff';c.shadowBlur=level>=3?18:8;gem(55,0,level>=4?11:8,'#94e8fa');c.restore()}
  if(level>=3){circle(-8,0,5,'#e8c98d','#294539')}
  c.restore();c.restore();
 }
 function mob(e,time){
  const r=e.radius,cold=e.slow>0;
  c.save();c.translate(e.x,e.y);
  c.save();c.scale(1,.6);circle(3,8,r+2,'#081b1a99');c.restore();
  if(e.kind==='brutes'){
   circle(0,0,r,'#634c46','#332f35');circle(-4,-6,r*.77,'#ae8865','#5b5045');
   for(const dir of [-1,1]){
    poly([[dir*r*.5,-r*.35],[dir*(r+.25*r),-r*.8],[dir*r*.8,0]],'#d2b997','#4a403f',2);
    circle(dir*r*.74,r*.6,5,'#84645c','#403b40');
   }
   rect(-r*.65,r*.1,r*1.3,r*.45,'#52433e',3);
   rect(-r*.45,-r*.27,r*.25,r*.2,'#fff0c3',2);
   rect(r*.2,-r*.27,r*.25,r*.2,'#fff0c3',2);
   line([[-r*.35,r*.45],[r*.35,r*.45]],'#2a3035',3);
  }else if(e.kind==='swarm'){
   const flap=Math.sin(time*16+e.id)*3;
   poly([[-r*.35,0],[-r*1.6,-r*.8-flap],[-r*1.5,r*.55+flap]],'#c8a7dd','#735e83',1.5);
   poly([[r*.35,0],[r*1.6,-r*.8-flap],[r*1.5,r*.55+flap]],'#b69ad4','#685977',1.5);
   circle(0,0,r,'#78628e','#3c3556');circle(-2,-3,r*.7,'#cbb4dd');
   circle(2,-2,2,'#2b2542');gem(0,r*.75,3,'#f5d9f5');
  }else{
   circle(0,0,r,'#526344','#2a4234');circle(-2,-3,r*.83,'#9cbd75');
   for(const side of [-1,1]){
    poly([[side*r*.3,-r*.45],[side*r*.98,-r*.9],[side*r*.8,-r*.05]],'#75996b','#324c39',1.3);
   }
   circle(-r*.35,-2,2.5,'#292f28');circle(r*.35,-2,2.5,'#292f28');
   rect(-r*.35,r*.25,r*.7,3,'#344237',2);
   for(let i=0;i<3;i++)circle((i-1)*4,-r*.7,2,'#b4d999');
  }
  if(cold){c.strokeStyle='#a8f1ff';c.lineWidth=2;c.beginPath();c.arc(0,0,r+4,0,TAU);c.stroke();gem(0,-r-7,4,'#d2ffff')}
  c.restore();
 }
 return {ground,resource,building,hero,mob,circle,gem,line};
}
