'use client';
import { useEffect, useRef, useState } from 'react';
import { createGame, addPlayer, command, tick, snapshot, BUILDINGS, WAVES, WEAPONS, weaponUpgradeCost, upgradeCost, distance } from '../game/engine.mjs';
import { createRenderer } from '../game/renderer.mjs';

const icons={wall:'▥',arrow:'➶',cannon:'✹',frost:'❄',mine:'◆'};
const weaponIcons={blade:'⚔',bow:'➶',spear:'⟐',hammer:'⚒',staff:'✧'};
const kinds=['wall','arrow','cannon','frost','mine'];
const zero={x:0,y:0,angle:0,attack:false};
const configuredServer=process.env.NEXT_PUBLIC_GAME_SERVER_URL||'';
export default function Game(){
 const canvas=useRef(null),control=useRef(null);
 const [config,setConfig]=useState(null),[name,setName]=useState(''),[code,setCode]=useState(''),[server,setServer]=useState(configuredServer);
 const [hud,setHud]=useState(null),[status,setStatus]=useState(''),[message,setMessage]=useState(''),[saved,setSaved]=useState(null),[help,setHelp]=useState(false);
 const [build,setBuild]=useState(null),[selected,setSelected]=useState(null),[sound,setSound]=useState(false);
 useEffect(()=>{try{setName(localStorage.getItem('astra-name')||'');setSaved(JSON.parse(sessionStorage.getItem('astra-session')||'null'))}catch{}},[]);
 function begin(mode,resume){
  const nickname=name.trim()||'Explorateur';
  if(mode!=='solo'){
   const address=resume?.server||server;
   try{const url=new URL(address);if(!['ws:','wss:'].includes(url.protocol))throw new Error();if(location.protocol==='https:'&&url.protocol!=='wss:')throw new Error()}catch{setMessage('Configurez une adresse de serveur WebSocket valide (wss://…/ws en ligne).');return}
   if(mode==='join'&&!/^[A-F0-9]{10}$/i.test(code.trim())){setMessage('Entrez le code de salon à 10 caractères.');return}
  }
  try{localStorage.setItem('astra-name',nickname)}catch{}
  setMessage('');setHud(null);setBuild(null);setSelected(null);setConfig({mode,name:nickname,code:code.trim().toUpperCase(),server:resume?.server||server,resume});
 }
 useEffect(()=>{
  if(!config||!canvas.current)return;
  let disposed=false,state=null,myId='',game=null,ws=null,raf=0,retry=null,attempts=0,session=config.resume||null,reconnect=false;
  let keys=new Set(),held=false,auto=false,opts={build:null,selected:null,pointer:null,zoom:1},last=performance.now(),lastHud=0,lastSound=-1,audio=null,soundEnabled=false;
  const renderer=createRenderer(canvas.current);
  function notify(s){setMessage(s)}
  function beep(){
   if(!soundEnabled)return;
   try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();
    const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.value=190;gain.gain.setValueAtTime(.025,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.07);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.08)
   }catch{}
  }
  function send(action){
   if(game){const err=command(game,myId,action);if(err)notify(err);return}
   if(ws?.readyState===WebSocket.OPEN&&myId)ws.send(JSON.stringify({type:'action',action}));
   else if(action.type!=='input')notify('Connexion en cours. Patientez.');
  }
  function choose(kind){opts.build=opts.build===kind?null:kind;opts.selected=null;setBuild(opts.build);setSelected(null)}
  control.current={send,choose,sound:v=>{soundEnabled=v},zoom:d=>opts.zoom=Math.max(.6,Math.min(1.5,opts.zoom+d)),clear:()=>{opts.build=null;opts.selected=null;setBuild(null);setSelected(null)}};
  if(config.mode==='solo'){
   game=createGame(731);const p=addPlayer(game,'you',config.name);addPlayer(game,'bot','Sentinelle',true);myId=p.id;command(game,myId,{type:'ready'});state=snapshot(game);renderer.reset(p);setStatus('Entraînement · local');notify('Récoltez au clic, construisez avec 1–5. Les attaques commencent après 30 secondes.');
  }else{
   function connect(){
    if(disposed)return;
    setStatus(reconnect?'Reconnexion…':'Connexion au serveur…');
    ws=new WebSocket(config.server);
    ws.onopen=()=>{if(disposed){ws.close();return}attempts=0;ws.send(JSON.stringify(session?{type:'resume',protocol:1,code:session.code,token:session.token}:{type:config.mode,protocol:1,name:config.name,code:config.code}))};
    ws.onmessage=event=>{
     if(disposed)return;let data;try{data=JSON.parse(event.data)}catch{return}
     if(data.type==='welcome'){
      myId=data.id;session={id:myId,token:data.token,code:data.code,server:config.server};
      try{sessionStorage.setItem('astra-session',JSON.stringify(session))}catch{}
      setSaved(session);setStatus('En ligne · salon '+data.code);reconnect=true;
     }else if(data.type==='state'){state=data.state;if(!state?.players)return;if(!state.time){let p=state.players.find(p=>p.id===myId);if(p)renderer.reset(p)}}
     else if(data.type==='error'){notify(data.message);if(!myId)setStatus('Connexion refusée — revenez au menu');if(data.message.includes('Session expirée')){session=null;try{sessionStorage.removeItem('astra-session')}catch{}setSaved(null)}}
    };
    ws.onerror=()=>{if(!disposed)setStatus('Serveur injoignable — vérifiez son adresse ou attendez son réveil')};
    ws.onclose=e=>{
     if(disposed)return;
     if(e.code===4001){setStatus('Session ouverte dans un autre onglet');notify('Cette session a été reprise ailleurs.');return}
     myId='';
     if(!session){setStatus('Connexion fermée — revenez au menu pour réessayer');return}
     setStatus('Connexion perdue · tentative de reconnexion…');retry=setTimeout(connect,Math.min(10000,1000*2**attempts++));
    };
   }
   connect();
  }
  const onMove=e=>{opts.pointer=renderer.worldAt(e.clientX,e.clientY)};
  const onDown=e=>{
   if(e.button!==0)return;e.preventDefault();canvas.current?.focus();onMove(e);
   if(!state||state.phase!=='playing')return;
   if(opts.build){send({type:'build',kind:opts.build,...opts.pointer});return}
   const p=state.players.find(p=>p.id===myId),b=state.buildings.find(b=>b.owner===myId&&distance(b,opts.pointer)<b.radius+6);
   opts.selected=b?.id||null;setSelected(opts.selected);if(!b&&p)held=true;
  };
  const onUp=()=>held=false;
  const resetInput=()=>{keys.clear();held=false;auto=false;send({type:'input',...zero})};
  const onKey=e=>{
   if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
   if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
   keys.add(e.code);if(e.repeat)return;
   if(/^Digit[1-5]$/.test(e.code))choose(kinds[Number(e.code.slice(-1))-1]);
   if(e.code==='Escape'){opts.build=null;opts.selected=null;setBuild(null);setSelected(null)}
   if(e.code==='Space')auto=!auto;
   if(e.code==='KeyE'&&opts.selected)send({type:'upgrade',id:opts.selected});
   if(e.code==='KeyR'&&opts.selected)send({type:'repair',id:opts.selected});
   if(e.code==='KeyF')send({type:'heal'});
   if(e.code==='KeyX'){
    const me=state?.players.find(p=>p.id===myId);
    if(me){const available=Object.keys(WEAPONS).filter(k=>me.weaponLevels?.[k]);const next=available[(available.indexOf(me.weapon)+1)%available.length];if(next)send({type:'equip',kind:next})}
   }
  };
  const onKeyUp=e=>keys.delete(e.code);
  const onContext=e=>{e.preventDefault();control.current?.clear();held=false};
  const onWheel=e=>{e.preventDefault();opts.zoom=Math.max(.6,Math.min(1.5,opts.zoom-e.deltaY*.001))};
  const node=canvas.current;
  node.addEventListener('pointermove',onMove);node.addEventListener('pointerdown',onDown);node.addEventListener('contextmenu',onContext);node.addEventListener('wheel',onWheel,{passive:false});
  window.addEventListener('pointerup',onUp);window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKeyUp);window.addEventListener('blur',resetInput);
  const inputTimer=setInterval(()=>{
   if(!state||state.phase!=='playing')return;const p=state.players.find(p=>p.id===myId);if(!p)return;
   const x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('KeyQ')||keys.has('ArrowLeft'));
   const y=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('KeyZ')||keys.has('ArrowUp'));
   const angle=opts.pointer?Math.atan2(opts.pointer.y-p.y,opts.pointer.x-p.x):p.angle;
   send({type:'input',x,y,angle,attack:(held||auto)&&!opts.build});
  },50);
  function frame(now){
   if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;
   if(game){tick(game,dt);state=snapshot(game)}
   if(state){
    renderer.draw(state,myId,opts,dt);
    let shot=state.effects?.find(e=>e.kind==='swing');if(shot&&shot.id!==lastSound){lastSound=shot.id;beep()}
    if(now-lastHud>180){lastHud=now;setHud({...state,myId,code:session?.code||'LOCAL'})}
   }
   raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  return()=>{
   disposed=true;clearTimeout(retry);clearInterval(inputTimer);cancelAnimationFrame(raf);
   if(ws){ws.onclose=null;ws.close()}audio?.close();renderer.destroy();control.current=null;
   node.removeEventListener('pointermove',onMove);node.removeEventListener('pointerdown',onDown);node.removeEventListener('contextmenu',onContext);node.removeEventListener('wheel',onWheel);
   window.removeEventListener('pointerup',onUp);window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',resetInput);
  };
 },[config]);
 useEffect(()=>{control.current?.sound(sound)},[sound,config]);
 const player=hud?.players.find(p=>p.id===hud.myId),enemy=hud?.players.find(p=>p.id!==hud.myId);
 const building=hud?.buildings.find(b=>b.id===selected),core=hud?.buildings.find(b=>b.owner===hud.myId&&b.kind==='core');
 const act=action=>control.current?.send(action);
 function leave(){if(hud?.phase==='playing'&&!confirm('Quitter la partie ? En ligne, le jeu continue et vous disposez de 60 secondes pour revenir.'))return;setConfig(null);setHud(null);setMessage('')}
 async function copy(){try{await navigator.clipboard.writeText(hud.code);setMessage('Code du salon copié.')}catch{setMessage('Code du salon : '+hud.code)}}
 if(!config)return <main className="landing">
  <nav className="nav"><a className="brand" href="/">✦ ASTRA<span>GAME</span></a><span className="version">ALPHA 0.2 · PC</span><a className="source" href="https://github.com/MatisseAD/AstraGame" target="_blank" rel="noreferrer">GitHub ↗</a></nav>
  <div className="landingGrid">
   <section className="intro"><div className="eyebrow"><i/> STRATÉGIE & SURVIE EN TEMPS RÉEL</div><h1>Construisez.<br/>Résistez.<br/><em>Ripostez.</em></h1><p>Un bastion à protéger. Un rival à faire tomber.<br/>Récoltez, fortifiez et libérez vos créatures dans un duel où chaque ressource compte.</p>
    <div className="features"><div><b>01</b><span>Un monde à explorer</span></div><div><b>02</b><span>Votre propre forteresse</span></div><div><b>03</b><span>Des vagues à envoyer</span></div></div>
    <div className="scene" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="crystal"/><span className="tree t1">♣</span><span className="tree t2">♣</span><span className="tower tw1">▥</span><span className="tower tw2">➶</span><span className="spark s1">✦</span><span className="spark s2">✦</span></div>
   </section>
   <section className="joinPanel"><div className="panelHeading"><span className="eyebrow">LE CHAMP DE BATAILLE VOUS ATTEND</span><h2>Entrez dans l’arène.</h2><p>Invitez un ami ou entraînez-vous contre la Sentinelle.</p></div>
    <label>VOTRE PSEUDO<input maxLength={18} value={name} onChange={e=>setName(e.target.value)} placeholder="Explorateur" autoComplete="nickname"/></label>
    <button className="primary" onClick={()=>begin('create')}>Créer un salon privé <span>↗</span></button>
    <div className="joinRow"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={10} placeholder="CODE DU SALON" aria-label="Code du salon"/><button className="secondary" onClick={()=>begin('join')}>Rejoindre</button></div>
    <div className="divider"><span>OU EXPLORER EN SOLO</span></div>
    <button className="training" onClick={()=>begin('solo')}><span>◈</span><div><strong>Terrain d’entraînement</strong><small>Adversaire IA · disponible sans serveur</small></div><span>→</span></button>
    {saved&&<button className="textButton" onClick={()=>begin('resume',saved)}>Reprendre le salon {saved.code} →</button>}
    <details><summary>Connexion au serveur</summary><label>ADRESSE WEBSOCKET<input value={server} onChange={e=>setServer(e.target.value)} placeholder="wss://votre-serveur/ws"/></label><p>Les salons nécessitent le serveur de jeu du projet. L’adresse peut être définie sur Vercel avec NEXT_PUBLIC_GAME_SERVER_URL.</p></details>
    {!server&&<div className="hint">Le mode entraînement est prêt. Configurez le serveur pour jouer à deux en ligne.</div>}
    {message&&<div className="notice" role="status">{message}</div>}
    <div className="guest">Session invité · aucun compte requis · duel 1 contre 1</div>
   </section>
  </div><footer>ZQSD / WASD pour explorer. Souris pour viser. Votre stratégie fait le reste.</footer>
 </main>;
 return <main className="gameShell">
  <header className="gameHeader"><a className="brand" onClick={leave}>✦ ASTRA<span>GAME</span></a><div className="resourceBar"><span>♣ <b>{Math.floor(player?.wood||0)}</b><small>BOIS</small></span><span>⬡ <b>{Math.floor(player?.stone||0)}</b><small>PIERRE</small></span><span className="gold">◆ <b>{Math.floor(player?.gold||0)}</b><small>OR</small></span></div><div className="headerActions"><button onClick={()=>setHelp(!help)}>?</button><button title="Son" onClick={()=>setSound(!sound)}>{sound?'♪':'♩'}</button><button title="Plein écran" onClick={()=>document.documentElement.requestFullscreen?.().catch(()=>setMessage('Plein écran indisponible.'))}>⛶</button><button onClick={leave}>Quitter</button></div></header>
  <div className="gameArea"><div className="viewport">
   <canvas ref={canvas} tabIndex={0} aria-label="Terrain de jeu. Déplacement ZQSD ou WASD. Souris pour viser et récolter."/>
   <div className="worldTop"><span className="chip">{hud&&hud.time%105>=60?'☾ NUIT':'☀ JOUR'} {1+(hud?.night||0)}</span><span className="chip">{hud?.time<30?'TRÊVE · '+Math.ceil(30-hud.time)+'s':Math.floor((hud?.time||0)/60)+':'+String(Math.floor((hud?.time||0)%60)).padStart(2,'0')}</span><span className="connection">{status}</span></div>
   {player&&<div className="heroStatus"><div><strong>{player.name}</strong><span>{WEAPONS[player.weapon||'blade']?.name} · niv. {player.level}</span></div><div className="hpTrack"><i style={{width:Math.max(0,player.hp/player.maxHp*100)+'%'}}/></div><small>{Math.ceil(player.hp)} / {player.maxHp} PV</small></div>}
   {message&&<div className="toast" role="status" onClick={()=>setMessage('')}>{message}<span>×</span></div>}
   <div className="hotbar">{kinds.map((kind,i)=><button className={build===kind?'active':''} key={kind} onClick={()=>control.current?.choose(kind)}><kbd>{i+1}</kbd><b>{icons[kind]}</b><span>{BUILDINGS[kind].name}</span><small>{BUILDINGS[kind].wood}♣ {BUILDINGS[kind].stone}⬡ {BUILDINGS[kind].gold}◆</small></button>)}</div>
   <div className="keyHint">ZQSD / WASD · Clic : attaque / récolte · X : changer d’arme · Espace : auto · Molette : zoom</div>
   {help&&<div className="helpBox"><button onClick={()=>setHelp(false)}>×</button><h3>Votre première partie</h3><p>1. Approchez un arbre ou une pierre. Visez et maintenez le clic pour récolter.</p><p>2. Construisez près de vous avec 1–5. Les mines génèrent de l’or en continu.</p><p>3. Cliquez sur votre bastion pour l’améliorer et débloquer les niveaux des tours.</p><p>4. Envoyez une vague contre l’adversaire. La nuit, des créatures sauvages attaquent les deux camps.</p><p>E : améliorer · R : réparer · F : soin · X : changer d’arme · Clic droit : annuler. Débloquez différentes armes dans l’arsenal, puis améliorez-les jusqu’au niveau 5.</p><p>Le premier bastion détruit perd. À 20 minutes, le bastion avec le plus de PV gagne.</p></div>}
   {!hud&&<div className="centerCard"><h2>Ouverture du portail…</h2><p>{status}</p><button className="secondary" onClick={leave}>Retour au menu</button></div>}
   {hud?.phase==='lobby'&&<div className="centerCard"><span className="eyebrow">SALON PRIVÉ</span><h2 className="roomCode">{hud.code}</h2><button className="secondary" onClick={copy}>Copier le code</button><p>Partagez ce code avec votre adversaire.</p><div className="lobbyPlayers">{hud.players.map(p=><div key={p.id}><span>{p.name}</span><b>{p.ready?'Prêt ✓':p.connected?'Connecté':'Déconnecté'}</b></div>)}</div><button className="primary" disabled={hud.players.length<2||player?.ready} onClick={()=>act({type:'ready'})}>{player?.ready?'En attente de l’adversaire…':hud.players.length<2?'En attente d’un second joueur…':'Je suis prêt →'}</button></div>}
   {player?.respawn>0&&hud?.phase==='playing'&&<div className="respawn">Vous êtes tombé · retour dans {Math.ceil(player.respawn)}s</div>}
   {hud?.phase==='ended'&&<div className="centerCard"><span className="eyebrow">FIN DU DUEL</span><h2>{hud.winner===-1?'Égalité':hud.winner===player?.side?'Victoire !':'Bastion détruit'}</h2><p>{player?.kills} éliminations · {Math.floor(hud.time/60)} min {Math.floor(hud.time%60)} s</p><button className="primary" onClick={()=>{setConfig(null);setHud(null)}}>Retour à l’arène →</button></div>}
  </div>
  <aside className="sidebar">
   <div className="sectionTitle">VOTRE BASTION <span>NIV. {core?.level||1}</span></div><div className="coreHealth"><strong>{Math.ceil(core?.hp||0)}</strong><span>/ {core?.maxHp||2400} PV</span></div><div className="hpTrack"><i style={{width:((core?.hp||0)/(core?.maxHp||2400)*100)+'%'}}/></div>
   <div className="opponent"><small>ADVERSAIRE</small><strong>{enemy?.name||'En attente…'}</strong><span>{enemy?.connected?'● Connecté':'○ Hors ligne'}</span></div>
   <div className="sectionTitle">PORTAIL OFFENSIF <span>{player?.waveCd>0?Math.ceil(player.waveCd)+'s':'PRÊT'}</span></div>
   {Object.entries(WAVES).map(([kind,w])=><button className="waveButton" key={kind} disabled={hud?.phase!=='playing'||player?.waveCd>0||player?.gold<w.gold||hud?.time<30} onClick={()=>act({type:'wave',kind})}><span className={'monster '+kind}>{kind==='brutes'?'⬟':kind==='swarm'?'✧':'♟'}</span><span><strong>{w.name}</strong><small>{w.count} créatures · +{w.income} or/s</small></span><b>{w.gold}◆</b></button>)}
   <div className="sectionTitle">{building?'SÉLECTION':'ÉQUIPEMENT'}</div>
      {building?<div className="selection">
    <strong>{BUILDINGS[building.kind].name} · niveau {building.level}/5</strong>
    <small>{Math.ceil(building.hp)} / {building.maxHp} PV</small>
    <div className="tierProgress">{[1,2,3,4,5].map(n=><i key={n} className={n<=building.level?'reached':''} />)}</div>
    <small>Chaque niveau débloque un nouveau modèle, plus de résistance et {BUILDINGS[building.kind].range?'de portée.':'des détails supplémentaires.'}</small>
    <button className="secondary" disabled={building.level>=5} onClick={()=>act({type:'upgrade',id:building.id})}> {building.level>=5?'Amélioration maximale':'Évoluer au niveau '+(building.level+1)+' [E]'}{building.level<5&&<small>{upgradeCost(building).wood}♣ {upgradeCost(building).stone}⬡ {upgradeCost(building).gold}◆</small>}</button>
    <button className="subtle" onClick={()=>act({type:'repair',id:building.id})}>Réparer [R] · 20♣ 15⬡ 25◆</button>
    {building.kind!=='core'&&<button className="subtle" onClick={()=>act({type:'sell',id:building.id})}>Vendre · remboursement 50%</button>}
   </div>:<div className="selection"><p>Cliquez sur un bâtiment pour l’améliorer. Les cinq niveaux possèdent des silhouettes uniques.</p></div>}
   <div className="sectionTitle">ARSENAL <span>X POUR CHANGER</span></div>
   <div className="weaponList">{Object.entries(WEAPONS).map(([kind,w])=>{
    const lvl=player?.weaponLevels?.[kind]||0,active=(player?.weapon||'blade')===kind;
    return <div className={'weaponCard '+(active?'equipped':'')} key={kind}>
     <div className="weaponOverview"><span className={'weaponGlyph '+kind}>{weaponIcons[kind]}</span><span><strong>{w.name}</strong><small>{w.description}</small></span><b>{lvl?'NIV. '+lvl:'VERROUILLÉ'}</b></div>
     <div className="weaponStats"><span>ATQ {Math.round(w.damage*(1+(Math.max(lvl,1)-1)*.36))}</span><span>PORTÉE {w.range+(Math.max(lvl,1)-1)*(['ranged','magic'].includes(w.style)?16:5)}</span><span>{(1/w.rate).toFixed(1)}/s</span></div>
     {lvl?active?<button className="weaponAction" disabled={lvl>=5||hud?.phase!=='playing'||player?.gold<weaponUpgradeCost(kind,lvl)} onClick={()=>act({type:'weapon'})}>{lvl>=5?'Niveau maximal':'Améliorer · '+weaponUpgradeCost(kind,lvl)+'◆'}</button>
       :<button className="weaponAction" disabled={hud?.phase!=='playing'} onClick={()=>act({type:'equip',kind})}>Équiper cette arme</button>
      :<button className="weaponAction" disabled={hud?.phase!=='playing'||player?.gold<w.unlock} onClick={()=>act({type:'unlock',kind})}>Débloquer · {w.unlock}◆</button>}
    </div>
   })}</div>
   <button className="heal" disabled={player?.healCd>0} onClick={()=>act({type:'heal'})}>✚ Soin [F] · {player?.healCd>0?Math.ceil(player.healCd)+'s':'45◆'}</button>
   <p className="sideNote">La récolte, les défenses et les vagues partagent les mêmes ressources. Choisissez votre priorité.</p>
  </aside></div>
 </main>;
}
