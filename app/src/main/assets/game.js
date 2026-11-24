'use strict';
// ================== Мол Мол: Генеральная уборка ==================
const Bridge = window.AndroidBridge || null;
const Store = {
  get(k){try{return Bridge?Bridge.load(k):localStorage.getItem(k);}catch(e){return null;}},
  set(k,v){try{Bridge?Bridge.save(k,v):localStorage.setItem(k,v);}catch(e){}}
};
const $ = id => document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a), rint=(a,b)=>Math.floor(rnd(a,b+1)), clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const TAU=Math.PI*2;

// ---------- Save ----------
const DEF={coins:0,unlocked:1,stars:[0,0,0,0,0,0,0,0],meta:{},machine:0,machines:[0],sound:true,music:true,vibro:true,shake:true,nums:true,bestEndless:0,intro:false};
let save=(()=>{try{return Object.assign({},DEF,JSON.parse(Store.get('molmol2')||'{}'));}catch(e){return Object.assign({},DEF);}})();
function persist(){Store.set('molmol2',JSON.stringify(save));}
function vibrate(ms){if(!save.vibro)return;try{Bridge?Bridge.vibrate(ms|0):navigator.vibrate&&navigator.vibrate(ms);}catch(e){}}

// ---------- Audio ----------
let AC=null,master=null,musicGain=null,noiseBuf=null,lastSfx={};
function audioInit(){
  if(AC){if(AC.state==='suspended')AC.resume();return;}
  try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  master=AC.createGain();master.gain.value=.5;master.connect(AC.destination);
  musicGain=AC.createGain();musicGain.gain.value=save.music?.16:0;musicGain.connect(master);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*.5,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  startMusic();
}
function tone(f,dur,type='square',vol=.15,slide=0,delay=0){
  if(!AC||!save.sound)return;const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);
}
function noise(dur,vol=.2,freq=1200){
  if(!AC||!save.sound)return;const t=AC.currentTime,s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();
  s.buffer=noiseBuf;f.type='lowpass';f.frequency.value=freq;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur);
}
function sfx(n){
  if(G&&G.demo)return;
  const now=performance.now();if(lastSfx[n]&&now-lastSfx[n]<60)return;lastSfx[n]=now;
  switch(n){
    case'shoot':tone(880,.06,'triangle',.05,-400);break;
    case'hit':noise(.05,.08,2500);break;
    case'kill':tone(300,.1,'square',.06,-200);break;
    case'gem':tone(1200+Math.random()*300,.05,'sine',.06);break;
    case'coin':tone(1500,.06,'square',.05);tone(2000,.08,'square',.05,0,.05);break;
    case'hurt':tone(160,.2,'sawtooth',.15,-80);noise(.15,.15,800);break;
    case'level':[523,659,784,1047].forEach((f,i)=>tone(f,.14,'square',.08,0,i*.07));break;
    case'foam':noise(.6,.3,3000);tone(200,.5,'sine',.2,600);break;
    case'dash':noise(.15,.12,4000);break;
    case'bomb':noise(.3,.25,900);tone(120,.25,'sine',.2,-60);break;
    case'boss':tone(90,.8,'sawtooth',.2,-40);tone(60,1,'square',.12,0,.2);break;
    case'warn':tone(660,.1,'square',.06);tone(660,.1,'square',.06,0,.18);break;
    case'win':[392,523,659,784,1047,1319].forEach((f,i)=>tone(f,.2,'square',.09,0,i*.11));break;
    case'lose':[392,330,262,196].forEach((f,i)=>tone(f,.3,'triangle',.12,0,i*.18));break;
    case'click':tone(700,.04,'square',.05);break;
  }
}
// small chiptune sequencer
let musicStep=0,musicNext=0,musicFast=false;
const BASS=[45,45,52,45,48,48,43,43,45,45,52,45,50,48,47,43];
const ARP=[[69,72,76],[69,72,76],[67,71,74],[67,71,74]];
const mf=n=>440*Math.pow(2,(n-69)/12);
function startMusic(){
  setInterval(()=>{
    if(!AC||!musicGain)return;
    musicGain.gain.value=(save.music&&(state==='play'||state==='menu'))?(state==='menu'?.09:.14):0;
    const spb=(musicFast?.115:.14);
    if(musicNext<AC.currentTime)musicNext=AC.currentTime+.05;
    while(musicNext<AC.currentTime+.2){
      const t=musicNext,s=musicStep%32;
      const b=BASS[(s>>1)%16]+(musicFast?2:0);
      if(s%2===0)mnote(mf(b-12),spb*1.8,'triangle',.5,t);
      const ch=ARP[(s>>3)%4];mnote(mf(ch[s%3]+12+(musicFast?2:0)),spb*.8,'square',.12,t);
      if(s%4===0)mkick(t);
      musicStep++;musicNext+=spb;
    }
  },60);
}
function mnote(f,d,type,v,t){const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+d+.02);}
function mkick(t){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(40,t+.12);g.gain.setValueAtTime(.6,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+.16);}

// ---------- Data ----------
const FLOORS=[
 {name:'Атриум',sub:'Фонтан газировки',a:'#2c5a5c',b:'#33686a',ln:'#4f8b88',dirt:'#7a4f22',prop:'planter',en:['slime','dust','flyer'],late:['toxic'],boss:'soda',
  talk:[['Клава','Атриум. Кто-то разлил газировку по всему фонтану. Она шевелится.'],['Евгений','Газировка, которая шевелится. Отлично. Начинаем.']]},
 {name:'Супермаркет',sub:'Касса №13',a:'#c9cfd3',b:'#b9c0c5',ln:'#9aa3aa',dirt:'#6e5a3c',prop:'rack',en:['slime','dust','bin'],late:['robo'],boss:'till',
  talk:[['Клава','Касса номер тринадцать пробивает всех подряд. Включая нас.'],['Евгений','Чек не нужен.']]},
 {name:'Фудкорт',sub:'Вечный фритюр',a:'#a8583c',b:'#b56446',ln:'#7e3f2a',dirt:'#c79a2a',prop:'table',en:['fire','slime','dust'],late:['bin'],boss:'fryer',
  talk:[['Аркадий','…'],['Евгений','Да, Аркадий, пахнет картошкой. Но эта картошка нас ест.']]},
 {name:'Детская зона',sub:'Автомат с игрушками',a:'#5a4c8c',b:'#6a5a9e',ln:'#8a78c0',dirt:'#5c8a3a',prop:'balls',en:['plush','flyer','dust'],late:['crystal'],boss:'claw',
  talk:[['Клава','Плюшевые мишки сбежали из автомата. Они очень обнимательные.'],['Евгений','Обнимашки отменяются.']]},
 {name:'Бутики',sub:'Новая коллекция',a:'#6b4a33',b:'#7a5639',ln:'#4f3524',dirt:'#5a5a6a',prop:'hanger',en:['mannequin','crystal','flyer'],late:['toxic'],boss:'manq',
  talk:[['Клава','Манекены меняют позы, когда ты не смотришь.'],['Евгений','Тогда я буду смотреть очень внимательно.']]},
 {name:'Парковка',sub:'Минус второй уровень',a:'#3c4248',b:'#41474e',ln:'#d8b13a',dirt:'#3a2e22',prop:'pillar',en:['dust','bin','robo'],late:['toxic'],boss:'titan',
  talk:[['Клава','Мусорный контейнер вырос до размеров автобуса.'],['Евгений','Кто-то давно не вывозил мусор.']]},
 {name:'Выставка',sub:'Пыльные династии',a:'#b8955c',b:'#c4a166',ln:'#8e6f3e',dirt:'#8a7350',prop:'statue',en:['idol','mannequin','fire'],late:['crystal'],boss:'guard',
  talk:[['Клава','Здесь не убирали три тысячи лет. Пыль обрела самосознание.'],['Аркадий','…!']]},
 {name:'Серверная',sub:'ФАРАОН.bak',a:'#152230',b:'#182839',ln:'#2c7f8a',dirt:'#4a2e6a',prop:'server',en:['robo','crystal','idol','mannequin'],late:['fire','toxic'],boss:'core',
  talk:[['ФАРАОН.bak','Я — резервная копия. Меня нельзя удалить. Меня можно только восстановить.'],['Евгений','А я — уборщик. Меня нельзя остановить. Меня можно только не пускать на этаж.'],['Клава','Форматируем.']]}
];
const ED={
 slime:{hp:14,sp:62,r:16,dmg:8,xp:1,col:'#6fd36a',trail:1},
 toxic:{hp:32,sp:52,r:19,dmg:10,xp:2,col:'#b56be0',trail:1,split:'slime'},
 dust:{hp:8,sp:112,r:12,dmg:5,xp:1,col:'#9aa1a8'},
 flyer:{hp:12,sp:86,r:14,dmg:6,xp:1,col:'#a77cf0',fly:1},
 bin:{hp:48,sp:40,r:22,dmg:12,xp:3,col:'#4f8a62',shoot:{cd:3.2,sp:210,n:1}},
 fire:{hp:22,sp:55,r:15,dmg:9,xp:2,col:'#ff8a3c',shoot:{cd:2.6,sp:240,n:1}},
 crystal:{hp:26,sp:50,r:15,dmg:10,xp:2,col:'#8fe3ff',dash:1,fly:1},
 mannequin:{hp:36,sp:68,r:17,dmg:11,xp:3,col:'#e9dcc8',blink:1},
 idol:{hp:95,sp:30,r:26,dmg:14,xp:5,col:'#5fae7a',shoot:{cd:3.8,sp:170,n:8,ring:1}},
 robo:{hp:20,sp:98,r:15,dmg:20,xp:2,col:'#d14d5b',explode:1},
 plush:{hp:18,sp:80,r:15,dmg:7,xp:1,col:'#e7a2c4'}
};
const BOSSES={
 soda:{name:'Король пролитой газировки',hp:2000,r:58,sp:55,pats:['slam','ring','pools','summon'],min:'slime'},
 till:{name:'Кассовый пожиратель',hp:2600,r:56,sp:60,pats:['spread','spiral','dash','ring'],min:'dust'},
 fryer:{name:'Повелитель фритюра',hp:3200,r:58,sp:50,pats:['pools','spread','ring','summon'],min:'fire'},
 claw:{name:'Кукловод мягких игрушек',hp:3800,r:60,sp:58,pats:['summon','spread','dash','spiral'],min:'plush'},
 manq:{name:'Манекен без лица',hp:4400,r:52,sp:75,pats:['blink','dash','ring','summon','spread'],min:'mannequin'},
 titan:{name:'Мусорный титан',hp:5200,r:68,sp:45,pats:['slam','spread','summon','ring','pools'],min:'dust'},
 guard:{name:'Страж пыльных династий',hp:6000,r:62,sp:42,pats:['spiral','pools','ring','summon','laser'],min:'idol'},
 core:{name:'ФАРАОН.bak · Ядро',hp:7500,r:62,sp:50,pats:['laser','spiral','ring','summon','blink','spread'],min:'robo'}
};
const MACHINES=[
 {name:'Клава',col:'#3fb7a8',hp:100,speed:230,dmg:1,armor:0,start:'jet',desc:'Сбалансированная. Стартует с водяной струёй.',cost:0},
 {name:'ФуджиМой Турбо',col:'#ffc94d',hp:85,speed:280,dmg:.9,armor:0,start:'jet',bonus:'steam',desc:'Быстрая, хрупкая. Струя + пароочиститель.',cost:300,floor:2},
 {name:'ФуджиМой Пена',col:'#8ef0d6',hp:100,speed:220,dmg:1,armor:.05,start:'foam',bonus:'trail',desc:'Пенные пузыри и мокрый след.',cost:600,floor:4},
 {name:'ФуджиМой Бастион',col:'#9a7cf0',hp:150,speed:195,dmg:1.15,armor:.12,start:'bombs',bonus:'brush',desc:'Тяжёлая броня, бомбы и турбощётки.',cost:1000,floor:6}
];
const WEAP={
 jet:{ic:'💧',name:'Водяная струя',d:['Автоматически бьёт по ближайшему врагу','+урон, быстрее','Две струи','Струя пробивает врагов','Три струи, +урон']},
 foam:{ic:'🫧',name:'Пенные пузыри',d:['2 пузыря вращаются вокруг','3 пузыря','+урон, больше радиус','4 пузыря','5 пузырей, +урон']},
 bombs:{ic:'💣',name:'Водяные бомбы',d:['Бросок по врагам, брызги чистят пол','Чаще','Две бомбы','Больше радиус','Три бомбы, +урон']},
 brush:{ic:'🌀',name:'Турбощётки',d:['Урон всем рядом, шире уборка','+радиус','+урон','+радиус, отбрасывание','Максимальная мощь']},
 arkady:{ic:'🪳',name:'Аркадий',d:['Аркадий кусает врагов','Быстрее бегает','Собирает кристаллы','Кусает сильнее','Укус с брызгами']},
 steam:{ic:'♨️',name:'Пароочиститель',d:['Конус пара по курсу','+дальность','+урон','Чаще','Мощный пар']},
 trail:{ic:'💦',name:'Мокрый след',d:['Лужи ранят и замедляют врагов','Лужи дольше','+урон','Шире лужи','Максимум']}
};
const PASS={
 hp:{ic:'❤️',name:'Прочный корпус',d:'+20 к здоровью'},
 speed:{ic:'⚡',name:'Мотор',d:'+8% скорости'},
 dmg:{ic:'🔱',name:'Напор',d:'+10% урона'},
 cd:{ic:'⏱️',name:'Насос',d:'Оружие на 8% быстрее'},
 magnet:{ic:'🧲',name:'Магнит',d:'+30% радиус сбора'},
 armor:{ic:'🛡️',name:'Бампер',d:'−8% входящего урона'},
 regen:{ic:'🍵',name:'Термос',d:'+0.6 здоровья в секунду'},
 clean:{ic:'🧽',name:'Губка',d:'Пена заряжается на 25% быстрее'}
};
const META=[
 {k:'hp',ic:'❤️',name:'Корпус',d:'+10 здоровья',max:5,base:40},
 {k:'dmg',ic:'🔱',name:'Напор воды',d:'+6% урона',max:5,base:50},
 {k:'speed',ic:'⚡',name:'Мотор',d:'+4% скорости',max:5,base:40},
 {k:'magnet',ic:'🧲',name:'Магнит',d:'+12% радиус сбора',max:5,base:30},
 {k:'xp',ic:'📘',name:'Опыт смены',d:'+6% опыта',max:5,base:45},
 {k:'coin',ic:'💰',name:'Премия',d:'+10% монет',max:5,base:60},
 {k:'foam',ic:'🫧',name:'Запас пены',d:'Старт с 50% пены',max:1,base:150},
 {k:'revive',ic:'🔋',name:'Второе дыхание',d:'Одно воскрешение за смену',max:1,base:400},
 {k:'reroll',ic:'🎲',name:'Жребий',d:'+1 смена вариантов',max:3,base:80}
];
const metaCost=m=>Math.round(m.base*Math.pow((save.meta[m.k]||0)+1,1.5));

// ---------- Canvas ----------
const cv=$('c'),ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,zoom=1;
function resize(){DPR=Math.min(window.devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*DPR|0;cv.height=H*DPR|0;cv.style.width=W+'px';cv.style.height=H+'px';zoom=clamp(H/560,.55,1.4);
  $('rotate').classList.toggle('hidden',!(H>W*1.1));}
addEventListener('resize',resize);

// ---------- Sprite cache ----------
const SPR={};
function makeSprite(type,frame,white){
  const d=ED[type],S=3,size=Math.ceil(d.r*3.2),c=document.createElement('canvas');c.width=c.height=size*S;
  const g=c.getContext('2d');g.scale(S,S);g.translate(size/2,size/2);drawEnemyShape(g,type,d.r,frame);
  if(white){g.globalCompositeOperation='source-atop';g.fillStyle='#fff';g.fillRect(-size,-size,size*2,size*2);}
  return {c,size};
}
function getSpr(type,frame,white){const k=type+frame+(white?'w':'');return SPR[k]||(SPR[k]=makeSprite(type,frame,white));}
function eyes(g,x,y,s,dx=0,angry=0){
  g.fillStyle='#fff';g.beginPath();g.ellipse(x-s*1.1,y,s,s*1.2,0,0,TAU);g.ellipse(x+s*1.1,y,s,s*1.2,0,0,TAU);g.fill();
  g.fillStyle='#14202a';g.beginPath();g.arc(x-s*1.1+dx,y+s*.2,s*.5,0,TAU);g.arc(x+s*1.1+dx,y+s*.2,s*.5,0,TAU);g.fill();
  if(angry){g.strokeStyle='#14202a';g.lineWidth=s*.45;g.beginPath();g.moveTo(x-s*2,y-s*1.3);g.lineTo(x-s*.3,y-s*.7);g.moveTo(x+s*2,y-s*1.3);g.lineTo(x+s*.3,y-s*.7);g.stroke();}
}
function shade(hex,amt){let c=parseInt(hex.slice(1),16),r=(c>>16)+amt,g=((c>>8)&255)+amt,b=(c&255)+amt;return'rgb('+clamp(r,0,255)+','+clamp(g,0,255)+','+clamp(b,0,255)+')';}
function drawEnemyShape(g,type,r,f){
  const col=ED[type].col,sq=f?1.08:1,st=f?.93:1;g.lineWidth=2;g.strokeStyle='#0d1820';
  const grad=(c)=>{const q=g.createRadialGradient(-r*.3,-r*.4,r*.1,0,0,r*1.2);q.addColorStop(0,shade(c,60));q.addColorStop(1,shade(c,-30));return q;};
  switch(type){
   case'slime':case'toxic':
    g.fillStyle=grad(col);g.beginPath();g.moveTo(-r*sq,r*.7);g.quadraticCurveTo(-r*sq,-r*st,0,-r*st);g.quadraticCurveTo(r*sq,-r*st,r*sq,r*.7);g.quadraticCurveTo(0,r*1.05,-r*sq,r*.7);g.fill();g.stroke();
    if(type==='toxic'){g.fillStyle='#e6b8ff88';[[-.4,.1,.18],[.35,.35,.14],[.1,-.45,.12]].forEach(p=>{g.beginPath();g.arc(p[0]*r,p[1]*r,p[2]*r,0,TAU);g.fill();});}
    g.fillStyle='#ffffff66';g.beginPath();g.ellipse(-r*.45,-r*.45,r*.22,r*.12,-.6,0,TAU);g.fill();
    eyes(g,0,-r*.1,r*.2,0,type==='toxic');break;
   case'dust':
    g.fillStyle=shade(col,-20);for(let i=0;i<9;i++){const a=i/9*TAU+f*.3;g.beginPath();g.arc(Math.cos(a)*r*.7,Math.sin(a)*r*.7,r*.42,0,TAU);g.fill();}
    g.fillStyle=grad(col);g.beginPath();g.arc(0,0,r*.85,0,TAU);g.fill();eyes(g,0,-r*.1,r*.22,0,1);break;
   case'flyer':
    g.fillStyle='#d8e8ff99';g.beginPath();g.ellipse(-r*.9,-r*.4+(f?-3:3),r*.7,r*.35,-.5,0,TAU);g.ellipse(r*.9,-r*.4+(f?-3:3),r*.7,r*.35,.5,0,TAU);g.fill();
    g.fillStyle=grad(col);g.beginPath();g.arc(0,0,r*.85,0,TAU);g.fill();g.stroke();
    g.fillStyle='#fff';g.beginPath();g.arc(0,-r*.1,r*.42,0,TAU);g.fill();g.fillStyle='#2a1a4a';g.beginPath();g.arc(0,-r*.05,r*.2,0,TAU);g.fill();break;
   case'bin':
    g.fillStyle=grad(col);g.beginPath();g.moveTo(-r*.8,-r*.4);g.lineTo(r*.8,-r*.4);g.lineTo(r*.65,r);g.lineTo(-r*.65,r);g.closePath();g.fill();g.stroke();
    g.strokeStyle='#ffffff33';for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*r*.35,-r*.2);g.lineTo(i*r*.3,r*.85);g.stroke();}
    g.fillStyle='#1a1410';g.beginPath();g.ellipse(0,-r*.45,r*.8,r*.25,0,0,TAU);g.fill();
    g.fillStyle='#fff';for(let i=0;i<5;i++){g.beginPath();g.moveTo(-r*.6+i*r*.3,-r*.5);g.lineTo(-r*.45+i*r*.3,-r*.3);g.lineTo(-r*.3+i*r*.3,-r*.5);g.fill();}
    g.fillStyle=shade(col,30);g.save();g.translate(-r*.2,-r*.75);g.rotate(f?-.5:-.35);g.fillRect(-r*.8,-r*.15,r*1.6,r*.25);g.restore();
    g.fillStyle='#ffe46b';g.beginPath();g.arc(-r*.25,r*.15,r*.13,0,TAU);g.arc(r*.25,r*.15,r*.13,0,TAU);g.fill();break;
   case'fire':
    g.fillStyle=grad(col);g.beginPath();g.moveTo(0,-r*1.25*st);g.quadraticCurveTo(r*1.1,-r*.1,r*.8,r*.5);g.quadraticCurveTo(0,r*1.15,-r*.8,r*.5);g.quadraticCurveTo(-r*1.1,-r*.1,0,-r*1.25*st);g.fill();
    g.fillStyle='#ffe58a';g.beginPath();g.ellipse(0,r*.3,r*.45,r*.5,0,0,TAU);g.fill();eyes(g,0,r*.05,r*.18,0,1);break;
   case'crystal':
    g.fillStyle=grad(col);g.beginPath();g.moveTo(0,-r*1.2);g.lineTo(r*.85,0);g.lineTo(0,r*1.2);g.lineTo(-r*.85,0);g.closePath();g.fill();g.stroke();
    g.strokeStyle='#ffffff88';g.beginPath();g.moveTo(0,-r*1.2);g.lineTo(0,r*1.2);g.moveTo(-r*.85,0);g.lineTo(r*.85,0);g.stroke();
    g.fillStyle='#0b3550';g.beginPath();g.arc(-r*.25,-r*.15,r*.12,0,TAU);g.arc(r*.25,-r*.15,r*.12,0,TAU);g.fill();break;
   case'mannequin':
    g.fillStyle=shade(col,-25);g.fillRect(-r*.08,r*.3,r*.16,r*.8);g.fillRect(-r*.4,r*1,r*.8,r*.12);
    g.fillStyle=grad(col);g.beginPath();g.moveTo(-r*.8,-r*.1);g.quadraticCurveTo(0,-r*.35,r*.8,-r*.1);g.lineTo(r*.45,r*.5);g.lineTo(-r*.45,r*.5);g.closePath();g.fill();g.stroke();
    g.beginPath();g.ellipse(0,-r*.65,r*.36,r*.45,0,0,TAU);g.fill();g.stroke();
    g.fillStyle='#00000018';g.beginPath();g.ellipse(r*.1,-r*.6,r*.2,r*.3,0,0,TAU);g.fill();break;
   case'idol':
    g.fillStyle=grad(col);g.beginPath();g.roundRect(-r*.8,-r*.95,r*1.6,r*1.9,r*.25);g.fill();g.stroke();
    g.fillStyle='#2f5c3d';g.fillRect(-r*.55,-r*.35,r*.35,r*.18);g.fillRect(r*.2,-r*.35,r*.35,r*.18);g.fillRect(-r*.4,r*.3,r*.8,r*.14);
    g.fillStyle='#b9ffcf';g.beginPath();g.arc(-r*.37,-r*.26,r*.08,0,TAU);g.arc(r*.37,-r*.26,r*.08,0,TAU);g.fill();
    g.fillStyle='#7ccf7a88';g.beginPath();g.arc(-r*.5,r*.7,r*.25,0,TAU);g.arc(r*.6,-r*.8,r*.18,0,TAU);g.fill();break;
   case'robo':
    g.fillStyle='#00000033';g.beginPath();g.ellipse(0,r*.35,r,r*.5,0,0,TAU);g.fill();
    g.fillStyle=grad(col);g.beginPath();g.ellipse(0,0,r,r*.75,0,0,TAU);g.fill();g.stroke();
    g.fillStyle='#ffd166';g.fillRect(-r*.7,-r*.1,r*1.4,r*.12);
    g.fillStyle=f?'#fff':'#ff2a3a';g.beginPath();g.arc(0,-r*.35,r*.2,0,TAU);g.fill();break;
   case'plush':
    g.fillStyle=grad(col);g.beginPath();g.arc(-r*.6,-r*.65,r*.32,0,TAU);g.arc(r*.6,-r*.65,r*.32,0,TAU);g.fill();g.stroke();
    g.beginPath();g.arc(0,0,r*.9,0,TAU);g.fill();g.stroke();
    g.fillStyle='#fff3f8';g.beginPath();g.ellipse(0,r*.3,r*.4,r*.3,0,0,TAU);g.fill();
    g.fillStyle='#222';g.beginPath();g.arc(-r*.32,-r*.15,r*.12,0,TAU);g.arc(r*.32,-r*.15,r*.12,0,TAU);g.arc(0,r*.2,r*.1,0,TAU);g.fill();
    g.strokeStyle='#a0506a';g.lineWidth=1.5;g.beginPath();g.moveTo(r*.3,-r*.7);g.lineTo(r*.5,-r*.4);g.stroke();break;
  }
}

// ---------- Floor patterns ----------
const PAT={};
function floorPattern(i){
  if(PAT[i])return PAT[i];const F=FLOORS[i],S=160,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  g.fillStyle=F.a;g.fillRect(0,0,S,S);
  if(i===0){g.fillStyle=F.b;g.fillRect(0,0,80,80);g.fillRect(80,80,80,80);g.strokeStyle='#ffffff18';g.lineWidth=2;g.beginPath();g.moveTo(10,30);g.bezierCurveTo(50,10,60,70,140,60);g.stroke();}
  else if(i===1){for(let x=0;x<4;x++)for(let y=0;y<4;y++)if((x+y)%2){g.fillStyle=F.b;g.fillRect(x*40,y*40,40,40);}}
  else if(i===2){g.fillStyle=F.b;g.fillRect(0,0,80,80);g.fillRect(80,80,80,80);}
  else if(i===3){const cs=['#6a5aa8','#4f7fa8','#a85a8a','#5aa88a'];for(let x=0;x<2;x++)for(let y=0;y<2;y++){g.fillStyle=cs[(x+y*2)%4];g.fillRect(x*80+2,y*80+2,76,76);}}
  else if(i===4){for(let y=0;y<8;y++){g.fillStyle=y%2?F.a:F.b;g.fillRect((y%2)*40,y*20,160,20);g.fillStyle='#0002';g.fillRect(((y*37)%160),y*20,2,20);}}
  else if(i===5){for(let k=0;k<200;k++){g.fillStyle=Math.random()<.5?'#ffffff08':'#00000012';g.fillRect(Math.random()*S,Math.random()*S,2,2);}g.fillStyle='#d8b13a55';g.fillRect(0,76,60,6);}
  else if(i===6){g.fillStyle=F.b;g.fillRect(0,0,160,80);g.strokeStyle=F.ln;g.lineWidth=2;g.strokeRect(0,0,80,80);g.strokeRect(80,0,80,80);g.strokeRect(40,80,80,80);}
  else {g.strokeStyle='#2c7f8a55';g.lineWidth=1;for(let k=0;k<=S;k+=20){g.beginPath();g.moveTo(k,0);g.lineTo(k,S);g.moveTo(0,k);g.lineTo(S,k);g.stroke();}g.fillStyle='#46e0f033';g.fillRect(40,40,4,40);}
  g.strokeStyle=F.ln;g.globalAlpha=.6;g.lineWidth=2;g.strokeRect(0,0,S,S);g.globalAlpha=1;
  return PAT[i]=ctx.createPattern(c,'repeat');
}

// ---------- Game state ----------
const WW=2600,WH=1800,DC=50,GW=Math.ceil(WW/DC),GH=Math.ceil(WH/DC),FLOOR_TIME=180;
let state='loading',G=null,cam={x:WW/2,y:WH/2},shakeT=0,lastT=0,rerollLeft=0,pendingLv=0;
const input={jx:0,jy:0,jid:null,jbx:0,jby:0,kx:0,ky:0,keys:{}};

function newRun(floor,endless){
  const m=MACHINES[save.machine];
  G={floor,endless,theme:floor,t:0,kills:0,coins:0,xp:0,lvl:1,xpNext:6,enemies:[],shots:[],bad:[],gems:[],fx:[],texts:[],hazards:[],puddles:[],bombs:[],props:[],
    weapons:{},passives:{},boss:null,bossDone:false,clean:save.meta.foam?50:0,spawnAcc:0,nextElite:40,nextSwarm:55,nextBoss:FLOOR_TIME,bossIdx:0,
    dirt:new Float32Array(GW*GH),dirtTick:0,revive:save.meta.revive?1:0,wave:null,cleaned:0,id:0,
    p:{x:WW/2,y:WH/2,r:22,hp:0,face:1,inv:0,dashT:0,dashCd:0,dx:1,dy:0,moving:0},
    ark:{x:WW/2-40,y:WH/2,a:0,cd:0,tgt:null},w:{}};
  G.weapons[m.start]=1;if(m.bonus)G.weapons[m.bonus]=1;
  calcStats();G.p.hp=G.st.maxHp;
  const props=['planter','rack','table','balls','hanger','pillar','statue','server'];
  for(let k=0;k<22;k++){let x,y,r=rnd(28,48),tries=0;do{x=rnd(120,WW-120);y=rnd(120,WH-120);tries++;}while(tries<40&&(Math.hypot(x-WW/2,y-WH/2)<260||G.props.some(q=>Math.hypot(q.x-x,q.y-y)<q.r+r+90)));
    G.props.push({x,y,r,k:props[floor],s:Math.random()});}
  for(let k=0;k<30;k++)splat(rnd(100,WW-100),rnd(100,WH-100),rnd(1,3),.9);
  rerollLeft=1+(save.meta.reroll||0);pendingLv=0;
  cam.x=G.p.x;cam.y=G.p.y;musicFast=false;
}
function calcStats(){
  const m=MACHINES[save.machine],M=save.meta,P=G.passives;
  G.st={maxHp:m.hp+(M.hp||0)*10+(P.hp||0)*20,speed:m.speed*(1+(M.speed||0)*.04+(P.speed||0)*.08),dmg:m.dmg*(1+(M.dmg||0)*.06+(P.dmg||0)*.1),
   cd:Math.max(.5,1-(P.cd||0)*.08),magnet:90*(1+(M.magnet||0)*.12+(P.magnet||0)*.3),armor:Math.min(.6,m.armor+(P.armor||0)*.08),regen:(P.regen||0)*.6,
   cleanGain:1+(P.clean||0)*.25,xpGain:1+(M.xp||0)*.06,coinGain:1+(M.coin||0)*.1};
}
const diff=()=>G.endless?Math.min(9,G.t/80):G.floor;

// ---------- Dirt ----------
function splat(x,y,rad,amt){const cx=(x/DC)|0,cy=(y/DC)|0;for(let i=-rad;i<=rad;i++)for(let j=-rad;j<=rad;j++){if(i*i+j*j>rad*rad+1)continue;const a=cx+i,b=cy+j;if(a<0||b<0||a>=GW||b>=GH)continue;const k=b*GW+a;G.dirt[k]=Math.min(1,G.dirt[k]+amt*rnd(.6,1));}}
function cleanArea(x,y,r,rate,gain){let got=0;const x0=Math.max(0,((x-r)/DC)|0),x1=Math.min(GW-1,((x+r)/DC)|0),y0=Math.max(0,((y-r)/DC)|0),y1=Math.min(GH-1,((y+r)/DC)|0);
  for(let a=x0;a<=x1;a++)for(let b=y0;b<=y1;b++){const k=b*GW+a;if(G.dirt[k]<=0)continue;const cx=a*DC+DC/2,cy=b*DC+DC/2;if((cx-x)**2+(cy-y)**2>(r+DC*.5)**2)continue;const d=Math.min(G.dirt[k],rate);G.dirt[k]-=d;got+=d;}
  if(gain&&got>0){G.clean=Math.min(100,G.clean+got*6*G.st.cleanGain);G.cleaned+=got;}return got;}
function dirtAt(x,y){const a=(x/DC)|0,b=(y/DC)|0;return(a<0||b<0||a>=GW||b>=GH)?0:G.dirt[b*GW+a];}
function cleanliness(){let s=0;for(let i=0;i<G.dirt.length;i++)s+=G.dirt[i];return Math.round(clamp(100-s/G.dirt.length*400,0,100));}

// ---------- Spawning ----------
function spawnEnemy(type,x,y,elite){
  const d=ED[type],D=diff(),hm=(1+D*.45)*(1+G.t/160)*(elite?9:1);
  if(x===undefined){const vw=W/zoom/2+60,vh=H/zoom/2+60;for(let t=0;t<8;t++){const a=Math.random()*TAU,rr=Math.hypot(vw,vh)*rnd(.9,1.1);x=G.p.x+Math.cos(a)*rr;y=G.p.y+Math.sin(a)*rr;if(x>40&&y>40&&x<WW-40&&y<WH-40)break;}x=clamp(x,40,WW-40);y=clamp(y,40,WH-40);}
  const e={id:++G.id,type,x,y,r:d.r*(elite?1.5:1),hp:d.hp*hm,maxHp:d.hp*hm,sp:d.sp*(1+D*.04)*(elite?.85:1),dmg:d.dmg*(1+D*.2),xp:d.xp*(elite?12:1),elite,kx:0,ky:0,flash:0,slow:0,cd:rnd(1,3),fcd:0,bcd:0,anim:Math.random()*5,face:1,state:0,st:0,trail:0};
  G.enemies.push(e);return e;
}
function spawnLogic(dt){
  const F=FLOORS[G.theme];let pool=F.en.slice();if(G.t>90||G.endless)pool=pool.concat(F.late);
  if(G.endless&&G.t>200)pool=pool.concat(FLOORS[(G.theme+3)%8].en);
  const bossOn=G.boss&&!G.boss.dead,D=diff();
  let rate=(.8+D*.15)*(1+G.t/70);if(bossOn)rate*=.3;rate=Math.min(rate,9);
  if(G.enemies.length<110+D*8){G.spawnAcc+=rate*dt;while(G.spawnAcc>=1){G.spawnAcc--;spawnEnemy(pick(pool));}}
  if(G.t>=G.nextElite&&!bossOn){G.nextElite+=45;spawnEnemy(pick(pool),undefined,undefined,true);toast('⭐ Элитный противник! Награда — сундук');}
  if(G.t>=G.nextSwarm&&!bossOn){G.nextSwarm+=50;const n=16+D*2,tp=pool[0];for(let i=0;i<n;i++){const a=i/n*TAU;spawnEnemy(tp==='idol'?'dust':tp,clamp(G.p.x+Math.cos(a)*440,40,WW-40),clamp(G.p.y+Math.sin(a)*440,40,WH-40));}toast('🌪 Окружают! Пробивайтесь!');sfx('warn');}
  if(!G.boss&&G.t>=G.nextBoss&&(!G.bossDone||G.endless))spawnBoss();
  G.dirtTick+=dt;if(G.dirtTick>5){G.dirtTick=0;let n=0;for(let k=0;k<50&&n<3;k++){const i=rint(0,G.dirt.length-1);if(G.dirt[i]>=.95&&Math.random()<.4){G.dirt[i]=.4;const x=(i%GW)*DC+DC/2,y=((i/GW)|0)*DC+DC/2;if(Math.hypot(x-G.p.x,y-G.p.y)>200){spawnEnemy('slime',x,y);n++;}}}}
}
function spawnBoss(){
  const key=G.endless?Object.keys(BOSSES)[G.bossIdx%8]:FLOORS[G.floor].boss,B=BOSSES[key];
  const sc=G.endless?(1+G.bossIdx*.6):1;
  const a=Math.random()*TAU,x=clamp(G.p.x+Math.cos(a)*380,100,WW-100),y=clamp(G.p.y+Math.sin(a)*380,100,WH-100);
  const b={id:++G.id,boss:1,key,name:B.name,x,y,r:B.r,hp:B.hp*sc,maxHp:B.hp*sc,sp:B.sp,dmg:(14+diff()*2.5),xp:60,kx:0,ky:0,flash:0,slow:0,cd:2.5,pi:0,act:null,phase:1,anim:0,face:1,z:0,intro:1.2};
  G.enemies.push(b);G.boss=b;G.bossIdx++;musicFast=true;sfx('boss');vibrate(200);shakeT=.6;
  for(let i=0;i<30;i++)G.fx.push({x,y,vx:rnd(-300,300),vy:rnd(-300,300),life:.8,max:.8,col:'#ffd780',s:rnd(3,7)});
  toast('⚠ '+B.name);
}

// ---------- Combat helpers ----------
let HASH=new Map();const HC=80;
function hashBuild(){HASH.clear();for(const e of G.enemies){const k=((e.x/HC)|0)*4096+((e.y/HC)|0);let a=HASH.get(k);if(!a)HASH.set(k,a=[]);a.push(e);}}
function query(x,y,r,cb){const x0=Math.max(0,((x-r)/HC)|0),x1=((x+r)/HC)|0,y0=Math.max(0,((y-r)/HC)|0),y1=((y+r)/HC)|0;
  for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++){const a=HASH.get(cx*4096+cy);if(a)for(const e of a)if(!e.dead&&(e.x-x)**2+(e.y-y)**2<(r+e.r)**2)cb(e);}}
function nearest(x,y,range){let best=null,bd=range*range;for(const e of G.enemies){if(e.dead||e.intro>0)continue;const d=(e.x-x)**2+(e.y-y)**2;if(d<bd){bd=d;best=e;}}return best;}
function hurt(e,dmg,kx,ky,col){
  if(e.dead)return;e.hp-=dmg;e.flash=.08;const kb=e.boss?.05:e.elite?.3:1;e.kx+=kx*kb;e.ky+=ky*kb;
  if(save.nums&&G.texts.length<70)G.texts.push({x:e.x+rnd(-8,8),y:e.y-e.r,v:Math.round(dmg),life:.6,col:col||'#fff'});
  sfx('hit');if(e.hp<=0)kill(e);
}
function kill(e){
  e.dead=true;
  if(e.boss){bossDown(e);return;}
  G.kills++;G.clean=Math.min(100,G.clean+.4*G.st.cleanGain);sfx('kill');
  dropGem(e.x,e.y,e.xp);
  if(e.elite){for(let i=0;i<8;i++)G.gems.push({x:e.x+rnd(-30,30),y:e.y+rnd(-30,30),k:'coin',v:1});G.gems.push({x:e.x,y:e.y,k:'chest',v:1});}
  else{const r=Math.random();if(r<.05)G.gems.push({x:e.x,y:e.y,k:'coin',v:1});else if(r<.062)G.gems.push({x:e.x,y:e.y,k:'heart',v:1});else if(r<.066)G.gems.push({x:e.x,y:e.y,k:'magnet',v:1});else if(r<.071)G.gems.push({x:e.x,y:e.y,k:'bomb',v:1});}
  splat(e.x,e.y,e.r>18?1:0,.5);
  const col=ED[e.type].col;for(let i=0;i<6;i++)G.fx.push({x:e.x,y:e.y,vx:rnd(-160,160),vy:rnd(-160,160),life:.4,max:.4,col,s:rnd(2,5)});
  if(ED[e.type].split)for(let i=0;i<2;i++)spawnEnemy(ED[e.type].split,e.x+rnd(-12,12),e.y+rnd(-12,12));
  if(ED[e.type].explode)explodeRobo(e);
}
function explodeRobo(e){G.hazards.push({x:e.x,y:e.y,r:60,warn:0,dur:.2,t:0,dmg:e.dmg*.6,col:'#ff5a5a',once:1});for(let i=0;i<12;i++)G.fx.push({x:e.x,y:e.y,vx:rnd(-250,250),vy:rnd(-250,250),life:.4,max:.4,col:'#ffb36b',s:rnd(3,6)});}
function dropGem(x,y,v){
  if(G.gems.length>260){let g=G.gems.find(q=>q.k==='xp');if(g){g.v+=v;return;}}
  G.gems.push({x:x+rnd(-6,6),y:y+rnd(-6,6),k:'xp',v});
}
function hurtPlayer(d){
  const p=G.p;if(p.inv>0||state!=='play')return;
  d*=(1-G.st.armor);p.hp-=d;p.inv=.55;if(save.shake)shakeT=.25;vibrate(40);sfx('hurt');
  G.texts.push({x:p.x,y:p.y-30,v:'-'+Math.round(d),life:.7,col:'#ff6b6b'});
  if(p.hp<=0){
    if(G.revive>0){G.revive--;p.hp=G.st.maxHp*.5;p.inv=2.5;foamWave(true);toast('🔋 Второе дыхание!');}
    else endRun(false);
  }
}
function foamWave(free){
  if(!free){if(G.clean<100)return;G.clean=0;}
  G.wave={x:G.p.x,y:G.p.y,r:0,hit:new Set()};sfx('foam');vibrate(120);if(save.shake)shakeT=.35;
  G.bad=G.bad.filter(b=>Math.hypot(b.x-G.p.x,b.y-G.p.y)>420);
}
function dash(){const p=G.p;if(p.dashCd>0)return;p.dashCd=2.4;p.dashT=.2;p.inv=Math.max(p.inv,.32);sfx('dash');
  let dx=input.jx||input.kx,dy=input.jy||input.ky;if(!dx&&!dy){dx=p.dx;dy=p.dy;}const l=Math.hypot(dx,dy)||1;p.ddx=dx/l;p.ddy=dy/l;}

// ---------- Weapons ----------
function updateWeapons(dt){
  const p=G.p,st=G.st,w=G.w,L=G.weapons;
  if(L.jet){w.jet=(w.jet||0)-dt;if(w.jet<=0){const t=nearest(p.x,p.y,480);if(t){const l=L.jet,n=[1,1,2,2,3][l-1],dm=10*(1+.25*(l-1))*st.dmg*(MACHINES[save.machine].speed>260?.85:1);
      const base=Math.atan2(t.y-p.y,t.x-p.x);for(let i=0;i<n;i++){const a=base+(i-(n-1)/2)*.14;G.shots.push({x:p.x+Math.cos(a)*20,y:p.y-8+Math.sin(a)*20,vx:Math.cos(a)*640,vy:Math.sin(a)*640,r:7,dmg:dm,pierce:l>=4?(l>=5?3:2):0,life:.8,hit:[]});}
      w.jet=(l>=2?.36:.42)*st.cd*(MACHINES[save.machine].speed>260?.8:1);sfx('shoot');}else w.jet=.1;}}
  if(L.foam){const l=L.foam,n=[2,3,3,4,5][l-1],R=[70,75,85,90,100][l-1],dm=8*(1+.22*(l-1))*st.dmg;w.foamA=(w.foamA||0)+dt*2.8;w.foamPts=[];
    for(let i=0;i<n;i++){const a=w.foamA+i/n*TAU,x=p.x+Math.cos(a)*R,y=p.y+Math.sin(a)*R*.85;w.foamPts.push([x,y]);query(x,y,14,e=>{if((e.fcd||0)<=0){hurt(e,dm,Math.cos(a)*120,Math.sin(a)*120,'#bff');e.fcd=.35;}});}}
  if(L.bombs){const l=L.bombs;w.bomb=(w.bomb||1.5)-dt;if(w.bomb<=0){w.bomb=[3.2,2.8,2.6,2.3,2][l-1]*st.cd;const n=[1,1,2,2,3][l-1];
      for(let i=0;i<n;i++){const t=nearest(p.x+rnd(-150,150),p.y+rnd(-150,150),380);const tx=t?t.x:p.x+rnd(-200,200),ty=t?t.y:p.y+rnd(-200,200);
        G.bombs.push({sx:p.x,sy:p.y,tx,ty,t:0,dur:.6,R:[85,95,100,120,135][l-1],dmg:26*(1+.25*(l-1))*st.dmg});}}}
  if(L.brush){const l=L.brush,R=[58,66,70,82,95][l-1];w.brushR=R;w.brush=(w.brush||0)-dt;if(w.brush<=0){w.brush=.3;const dm=6*(1+.3*(l-1))*st.dmg,kb=l>=4?160:60;
      query(p.x,p.y,R,e=>{const a=Math.atan2(e.y-p.y,e.x-p.x);hurt(e,dm,Math.cos(a)*kb,Math.sin(a)*kb,'#ffe08a');});}}
  if(L.arkady){const l=L.arkady,a=G.ark,spd=[240,300,300,320,350][l-1];a.cd-=dt;
    if(!a.tgt||a.tgt.dead||Math.hypot(a.tgt.x-p.x,a.tgt.y-p.y)>380)a.tgt=nearest(p.x,p.y,330);
    let tx=p.x-p.face*34,ty=p.y+18;if(a.tgt){tx=a.tgt.x;ty=a.tgt.y;}
    const d=Math.hypot(tx-a.x,ty-a.y);if(d>4){a.a=Math.atan2(ty-a.y,tx-a.x);const s=Math.min(d,spd*dt*(d>300?2:1));a.x+=Math.cos(a.a)*s;a.y+=Math.sin(a.a)*s;}
    if(a.tgt&&d<a.tgt.r+12&&a.cd<=0){const dm=14*(1+.3*(l-1))*st.dmg*(l>=4?1.3:1);hurt(a.tgt,dm,Math.cos(a.a)*80,Math.sin(a.a)*80,'#e8c39a');a.cd=l>=5?.4:.6;
      if(l>=5)query(a.tgt.x,a.tgt.y,50,e=>hurt(e,dm*.4,0,0,'#e8c39a'));}
    if(l>=3)for(const g of G.gems)if(g.k==='xp'&&(g.x-a.x)**2+(g.y-a.y)**2<3600)g.pull=1;}
  if(L.steam){const l=L.steam;w.steam=(w.steam||1)-dt;if(w.steam<=0){w.steam=[1.6,1.45,1.3,1.1,1][l-1]*st.cd;const R=[130,150,165,175,210][l-1],dm=14*(1+.28*(l-1))*st.dmg;
      const t=nearest(p.x,p.y,R+40),ang=t?Math.atan2(t.y-p.y,t.x-p.x):Math.atan2(p.dy,p.dx);w.steamFx={a:ang,R,t:.3};
      query(p.x,p.y,R,e=>{const a=Math.atan2(e.y-p.y,e.x-p.x);let da=Math.abs(((a-ang+Math.PI*3)%TAU)-Math.PI);if(da<.55)hurt(e,dm,Math.cos(a)*150,Math.sin(a)*150,'#e8f6ff');});
      cleanArea(p.x+Math.cos(ang)*R*.5,p.y+Math.sin(ang)*R*.5,R*.4,.5,true);}}
  if(w.steamFx){w.steamFx.t-=dt;if(w.steamFx.t<=0)w.steamFx=null;}
  if(L.trail){const l=L.trail;w.trail=(w.trail||0)-dt;if(w.trail<=0&&p.moving){w.trail=.22;G.puddles.push({x:p.x,y:p.y+10,r:[26,28,30,36,40][l-1],life:[1.5,2.2,2.5,3,3.5][l-1],dmg:4*(1+.35*(l-1))*st.dmg,tick:0});}}
  for(const q of G.puddles){q.life-=dt;q.tick-=dt;if(q.tick<=0){q.tick=.4;query(q.x,q.y,q.r,e=>{e.slow=.5;hurt(e,q.dmg,0,0,'#9fd9ff');});}}
  G.puddles=G.puddles.filter(q=>q.life>0);
  for(const b of G.bombs){b.t+=dt;if(b.t>=b.dur){b.done=1;sfx('bomb');query(b.tx,b.ty,b.R,e=>{const a=Math.atan2(e.y-b.ty,e.x-b.tx);e.slow=1.5;hurt(e,b.dmg,Math.cos(a)*200,Math.sin(a)*200,'#9fe7ff');});
      cleanArea(b.tx,b.ty,b.R,1,true);for(let i=0;i<16;i++){const a=i/16*TAU;G.fx.push({x:b.tx,y:b.ty,vx:Math.cos(a)*rnd(150,260),vy:Math.sin(a)*rnd(150,260),life:.45,max:.45,col:'#9fe7ff',s:rnd(3,6)});}}}
  G.bombs=G.bombs.filter(b=>!b.done);
}

// ---------- Boss AI ----------
function bossUpdate(b,dt){
  const p=G.p,B=BOSSES[b.key];b.anim+=dt;
  if(b.intro>0){b.intro-=dt;return;}
  if(b.phase===1&&b.hp<b.maxHp*.5){b.phase=2;toast('💢 '+b.name+' в ярости!');sfx('boss');for(let i=0;i<5;i++)spawnEnemy(B.min,b.x+rnd(-80,80),b.y+rnd(-80,80));}
  const ang=Math.atan2(p.y-b.y,p.x-b.x),dist=Math.hypot(p.x-b.x,p.y-b.y),ph=b.phase,spdMul=ph===2?1.25:1;b.face=p.x>b.x?1:-1;
  const A=b.act;
  if(A){A.t+=dt;
    switch(A.k){
     case'spread':if(A.t>=A.next){A.next+=.28;A.n--;const n=5+ph*2;for(let i=0;i<n;i++)bullet(b.x,b.y,ang+(i-(n-1)/2)*.15,240+ph*30,b.dmg*.7,bulCol(b));if(A.n<=0)b.act=null;}break;
     case'spiral':if(A.t>=A.next){A.next+=.09;A.a+=.33;for(let i=0;i<2+ph;i++)bullet(b.x,b.y,A.a+i*TAU/(2+ph),200,b.dmg*.6,bulCol(b));}if(A.t>2.6)b.act=null;break;
     case'dash':if(A.t<.75){A.a=ang;}else if(A.t<1.35){b.x+=Math.cos(A.a)*760*dt;b.y+=Math.sin(A.a)*760*dt;if(dist<b.r+p.r)hurtPlayer(b.dmg*1.2);}else{b.act=null;if(ph===2)ring(b,12);}break;
     case'slam':if(A.t<.9){b.z=Math.sin(A.t/.9*Math.PI)*120;b.x+=(A.tx-b.x)*Math.min(1,dt*3);b.y+=(A.ty-b.y)*Math.min(1,dt*3);}else{b.z=0;b.x=A.tx;b.y=A.ty;if(Math.hypot(p.x-A.tx,p.y-A.ty)<A.r)hurtPlayer(b.dmg*1.3);ring(b,10+ph*4);splat(A.tx,A.ty,2,.7);shakeT=.4;sfx('bomb');b.act=null;}break;
     case'laser':A.a+=dt*(A.t<.9?0:.75*A.dir*spdMul);if(A.t>.9){for(let i=0;i<A.n;i++){const la=A.a+i*TAU/A.n,dx=Math.cos(la),dy=Math.sin(la),px=p.x-b.x,py=p.y-b.y,proj=px*dx+py*dy;if(proj>0&&proj<950&&Math.abs(px*dy-py*dx)<p.r+8)hurtPlayer(b.dmg*.8);}}if(A.t>3.6)b.act=null;break;
     case'blink':if(A.t>.6&&!A.done){A.done=1;b.x=clamp(p.x+Math.cos(A.a)*260,80,WW-80);b.y=clamp(p.y+Math.sin(A.a)*260,80,WH-80);ring(b,14+ph*4);}if(A.t>1)b.act=null;break;
    }
  } else {
    const want=b.key==='manq'?180:240;const mv=(dist>want?1:-.4)*b.sp*spdMul*dt;b.x+=Math.cos(ang)*mv;b.y+=Math.sin(ang)*mv;
    if(dist<b.r+p.r)hurtPlayer(b.dmg);
    b.cd-=dt;if(b.cd<=0){const k=B.pats[b.pi++%B.pats.length];b.cd=(ph===2?1.3:1.9);startPat(b,k,ang);}
  }
  b.x=clamp(b.x,b.r,WW-b.r);b.y=clamp(b.y,b.r,WH-b.r);
}
function bulCol(b){return({soda:'#e0a050',till:'#fff2a8',fryer:'#ffc94d',claw:'#ff9ad5',manq:'#e9dcc8',titan:'#a3c46a',guard:'#ffe095',core:'#ff4d8a'})[b.key];}
function bullet(x,y,a,sp,dmg,col){if(G.bad.length<380)G.bad.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:8,dmg,col:col||'#ff7a7a',life:5});}
function ring(b,n){const o=Math.random()*TAU;for(let i=0;i<n;i++)bullet(b.x,b.y,o+i/n*TAU,190,b.dmg*.6,bulCol(b));}
function startPat(b,k,ang){
  const p=G.p,B=BOSSES[b.key];
  if(k==='ring'){ring(b,16+b.phase*6);if(b.phase===2)setTimeout(()=>{if(!b.dead&&G&&G.boss===b)ring(b,18);},350);}
  else if(k==='spread')b.act={k,t:0,next:0,n:3};
  else if(k==='spiral')b.act={k,t:0,next:0,a:ang};
  else if(k==='dash'){b.act={k,t:0,a:ang};sfx('warn');}
  else if(k==='slam'){b.act={k,t:0,tx:p.x,ty:p.y,r:120};G.hazards.push({x:p.x,y:p.y,r:120,warn:.9,dur:0,t:0,dmg:0,col:'#ff5a5a',visual:1});sfx('warn');}
  else if(k==='laser'){b.act={k,t:0,a:ang+.3,n:b.phase===2?4:3,dir:Math.random()<.5?1:-1};sfx('warn');}
  else if(k==='blink'){b.act={k,t:0,a:Math.random()*TAU};}
  else if(k==='pools'){const n=4+b.phase*2;for(let i=0;i<n;i++){const x=clamp(p.x+(i?rnd(-220,220):0),40,WW-40),y=clamp(p.y+(i?rnd(-180,180):0),40,WH-40);G.hazards.push({x,y,r:rnd(55,80),warn:1,dur:4.5,t:0,dmg:b.dmg*.5,col:bulCol(b),tick:0});splat(x,y,1,.8);}sfx('warn');}
  else if(k==='summon'){for(let i=0;i<4+b.phase*2;i++)spawnEnemy(B.min,b.x+rnd(-90,90),b.y+rnd(-90,90));}
}
function bossDown(b){
  shakeT=.8;vibrate(300);sfx('win');G.boss=null;musicFast=false;
  for(let i=0;i<60;i++)G.fx.push({x:b.x,y:b.y,vx:rnd(-400,400),vy:rnd(-400,400),life:1.2,max:1.2,col:pick(['#ffd780','#77e5d1','#fff']),s:rnd(3,8)});
  for(let i=0;i<30;i++)G.gems.push({x:b.x+rnd(-80,80),y:b.y+rnd(-80,80),k:'coin',v:1});
  for(let i=0;i<10;i++)dropGem(b.x+rnd(-60,60),b.y+rnd(-60,60),8);
  G.enemies.forEach(e=>{if(!e.dead&&!G.endless){e.dead=true;dropGem(e.x,e.y,e.xp);}});
  if(G.endless){G.gems.push({x:b.x,y:b.y,k:'chest',v:1});G.nextBoss=G.t+150;toast('Босс повержен! Следующий через 2.5 минуты');}
  else{G.bossDone=true;G.winT=2.5;toast('🏆 Этаж очищен!');}
}

// ---------- Update ----------
function update(dt){
  const p=G.p,st=G.st;G.t+=dt;
  // movement
  let mx=input.jx||input.kx,my=input.jy||input.ky;const ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml;}
  p.moving=ml>.1;if(p.moving){p.dx=mx;p.dy=my;if(Math.abs(mx)>.15)p.face=mx>0?1:-1;}
  const onDirt=dirtAt(p.x,p.y)>.3&&!G.weapons.brush;let sp=st.speed*(onDirt?.78:1);
  if(p.dashT>0){p.dashT-=dt;p.x+=p.ddx*sp*3.4*dt;p.y+=p.ddy*sp*3.4*dt;if(Math.random()<.7)G.fx.push({x:p.x,y:p.y,vx:0,vy:0,life:.25,max:.25,col:MACHINES[save.machine].col,s:14,ghost:1});}
  else{p.x+=mx*sp*dt;p.y+=my*sp*dt;}
  p.dashCd-=dt;p.inv-=dt;p.hp=Math.min(st.maxHp,p.hp+st.regen*dt);
  for(const q of G.props)pushOut(p,q);
  p.x=clamp(p.x,p.r,WW-p.r);p.y=clamp(p.y,p.r,WH-p.r);
  cleanArea(p.x,p.y+6,Math.max(p.r*1.3,G.w.brushR||0),dt*3,true);
  // camera
  cam.x+=(p.x-cam.x)*Math.min(1,dt*8);cam.y+=(p.y-cam.y)*Math.min(1,dt*8);
  spawnLogic(dt);hashBuild();updateWeapons(dt);
  // shots
  for(const s of G.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
    query(s.x,s.y,s.r,e=>{if(s.life<=0||s.hit.includes(e.id))return;s.hit.push(e.id);hurt(e,s.dmg,s.vx*.12,s.vy*.12,'#d8f6ff');if(s.pierce>0)s.pierce--;else s.life=0;});}
  G.shots=G.shots.filter(s=>s.life>0);
  // enemies
  for(const e of G.enemies){if(e.dead)continue;e.flash-=dt;e.fcd-=dt;e.slow-=dt;e.anim+=dt;
    if(e.boss){bossUpdate(e,dt);e.x+=e.kx*dt;e.y+=e.ky*dt;e.kx*=.85;e.ky*=.85;continue;}
    const d=ED[e.type],dx=p.x-e.x,dy=p.y-e.y,dist=Math.hypot(dx,dy)||1;let s=e.sp*(e.slow>0?.5:1);
    let vx=dx/dist*s,vy=dy/dist*s;if(d.fly){vx+=Math.cos(e.anim*3+e.id)*40;vy+=Math.sin(e.anim*3+e.id)*40;}
    if(d.dash){e.st-=dt;if(e.state===0&&e.st<=0&&dist<360){e.state=1;e.st=.5;e.da=Math.atan2(dy,dx);}else if(e.state===1){vx=vy=0;if(e.st<=0){e.state=2;e.st=.45;}}else if(e.state===2){vx=Math.cos(e.da)*360;vy=Math.sin(e.da)*360;if(e.st<=0){e.state=0;e.st=rnd(2,3.5);}}}
    if(d.blink){e.st-=dt;if(e.st<=0&&dist<520&&dist>150){if(e.state===0){e.state=1;e.st=.6;}else{const a=Math.random()*TAU;e.x=clamp(p.x+Math.cos(a)*110,30,WW-30);e.y=clamp(p.y+Math.sin(a)*110,30,WH-30);e.state=0;e.st=rnd(4,6);}}else if(e.st<=0)e.st=1;if(e.state===1){vx*=.1;vy*=.1;}}
    if(d.explode&&dist<70){e.st+=dt;vx*=.2;vy*=.2;if(e.st>.55){e.hp=0;kill(e);continue;}}
    if(d.shoot){e.cd-=dt;if(e.cd<=0&&dist<520){e.cd=d.shoot.cd*rnd(.9,1.2);const a=Math.atan2(dy,dx);if(d.shoot.ring)for(let i=0;i<d.shoot.n;i++)bullet(e.x,e.y,a+i/d.shoot.n*TAU,d.shoot.sp,e.dmg*.7,'#9ff0b0');else bullet(e.x,e.y,a,d.shoot.sp,e.dmg*.8,e.type==='fire'?'#ffb347':'#c9b27a');}}
    if(d.trail){e.trail-=dt;if(e.trail<=0){e.trail=1.2;splat(e.x,e.y,0,.18);}}
    e.x+=(vx+e.kx)*dt;e.y+=(vy+e.ky)*dt;e.kx*=.86;e.ky*=.86;if(Math.abs(vx)>5)e.face=vx>0?1:-1;
    if(!d.fly)for(const q of G.props)if(Math.abs(q.x-e.x)<q.r+e.r&&Math.abs(q.y-e.y)<q.r+e.r)pushOut(e,q);
    e.x=clamp(e.x,e.r,WW-e.r);e.y=clamp(e.y,e.r,WH-e.r);
    if(dist<e.r+p.r-4)hurtPlayer(e.dmg);
  }
  // separation
  for(const e of G.enemies){if(e.dead||e.boss)continue;query(e.x,e.y,e.r,o=>{if(o===e||o.boss)return;const dx=e.x-o.x,dy=e.y-o.y,dd=Math.hypot(dx,dy)||.1,ov=e.r+o.r-dd;if(ov>0){e.x+=dx/dd*ov*.3;e.y+=dy/dd*ov*.3;}});}
  G.enemies=G.enemies.filter(e=>!e.dead);
  // enemy bullets
  for(const b of G.bad){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if((b.x-p.x)**2+(b.y-p.y)**2<(b.r+p.r-6)**2){hurtPlayer(b.dmg);b.life=0;}if(b.x<0||b.y<0||b.x>WW||b.y>WH)b.life=0;}
  G.bad=G.bad.filter(b=>b.life>0);
  // hazards
  for(const h of G.hazards){h.t+=dt;if(h.t>h.warn){if(h.once){if(!h.fired){h.fired=1;if(Math.hypot(p.x-h.x,p.y-h.y)<h.r+p.r)hurtPlayer(h.dmg);}}
    else if(!h.visual){h.tick=(h.tick||0)-dt;if(h.tick<=0&&Math.hypot(p.x-h.x,p.y-h.y)<h.r){h.tick=.5;hurtPlayer(h.dmg);}}}}
  G.hazards=G.hazards.filter(h=>h.t<h.warn+h.dur);
  // foam wave
  if(G.wave){const wv=G.wave;wv.r+=dt*700;query(wv.x,wv.y,wv.r,e=>{if(wv.hit.has(e.id))return;wv.hit.add(e.id);const a=Math.atan2(e.y-wv.y,e.x-wv.x);hurt(e,(60+G.lvl*4)*st.dmg*(e.boss?1.5:1),Math.cos(a)*400,Math.sin(a)*400,'#bffcff');});
    cleanArea(wv.x,wv.y,wv.r,1,false);if(wv.r>430)G.wave=null;}
  // pickups
  const mag=st.magnet;
  for(const g of G.gems){const dx=p.x-g.x,dy=p.y-g.y,d2=dx*dx+dy*dy;
    if(g.pull||d2<mag*mag){g.pull=1;const d=Math.sqrt(d2)||1,s=Math.max(380,900-d);g.x+=dx/d*s*dt;g.y+=dy/d*s*dt;}
    if(d2<(p.r+10)**2){g.got=1;collect(g);}}
  G.gems=G.gems.filter(g=>!g.got);
  // fx
  for(const f of G.fx){f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=.92;f.vy*=.92;f.life-=dt;}
  G.fx=G.fx.filter(f=>f.life>0);if(G.fx.length>500)G.fx.splice(0,G.fx.length-500);
  for(const t of G.texts){t.y-=40*dt;t.life-=dt;}G.texts=G.texts.filter(t=>t.life>0);
  if(G.winT!==undefined){G.winT-=dt;for(const g of G.gems)g.pull=1;if(G.winT<=0)endRun(true);}
}
function pushOut(e,q){const dx=e.x-q.x,dy=e.y-q.y,d=Math.hypot(dx,dy)||.1,m=q.r+e.r*.8;if(d<m){e.x=q.x+dx/d*m;e.y=q.y+dy/d*m;}}
function collect(g){
  if(g.k==='xp'){G.xp+=g.v*G.st.xpGain;sfx('gem');while(G.xp>=G.xpNext){G.xp-=G.xpNext;G.lvl++;G.xpNext=Math.floor(6+G.lvl*4.2+Math.pow(G.lvl,1.65));pendingLv++;}if(pendingLv>0&&state==='play')openLevelUp();}
  else if(g.k==='coin'){G.coins+=1;sfx('coin');}
  else if(g.k==='heart'){G.p.hp=Math.min(G.st.maxHp,G.p.hp+G.st.maxHp*.3);sfx('level');toast('🌯 Шаурма из фудкорта: +30% здоровья');}
  else if(g.k==='magnet'){G.gems.forEach(q=>{if(q.k==='xp'||q.k==='coin')q.pull=1;});sfx('coin');}
  else if(g.k==='bomb'){foamWave(true);}
  else if(g.k==='chest'){G.coins+=10;sfx('level');pendingLv++;openLevelUp(true);}
}

// ---------- Level up ----------
function choices(){
  const opts=[];
  const nW=Object.keys(G.weapons).length;
  for(const k in WEAP){const l=G.weapons[k]||0;if(l<5&&(l>0||nW<6))opts.push({t:'w',k,l});}
  for(const k in PASS){const l=G.passives[k]||0;if(l<5)opts.push({t:'p',k,l});}
  const res=[];while(res.length<3&&opts.length){const i=Math.floor(Math.random()*opts.length);const o=opts.splice(i,1)[0];if(o.t==='w'&&o.l===0&&Math.random()<.25&&opts.length>2){opts.push(o);continue;}res.push(o);}
  if(!res.length)res.push({t:'heal'},{t:'gold'});
  return res;
}
function openLevelUp(chest){
  state='levelup';sfx('level');vibrate(60);$('luTitle').textContent=chest?'🎁 Сундук! Выберите улучшение':'Уровень '+G.lvl+' — выберите улучшение';
  renderChoices();show('levelup');
}
function renderChoices(){
  const box=$('luCards');box.innerHTML='';$('rerollN').textContent=rerollLeft;$('luReroll').disabled=rerollLeft<=0;
  for(const o of choices()){
    const b=document.createElement('button');b.className='up'+(o.l===0&&o.t!=='heal'&&o.t!=='gold'?' new':'');
    let ic,nm,lv,ds;
    if(o.t==='w'){ic=WEAP[o.k].ic;nm=WEAP[o.k].name;lv=o.l===0?'НОВОЕ':'УР. '+(o.l+1);ds=WEAP[o.k].d[o.l];}
    else if(o.t==='p'){ic=PASS[o.k].ic;nm=PASS[o.k].name;lv=o.l===0?'НОВОЕ':'УР. '+(o.l+1);ds=PASS[o.k].d;}
    else if(o.t==='heal'){ic='🌯';nm='Шаурма';lv='';ds='Восстановить 50% здоровья';}
    else {ic='💰';nm='Премия';lv='';ds='+25 монет';}
    b.innerHTML='<div class="ic">'+ic+'</div><b>'+nm+'</b><div class="lv">'+lv+'</div><small>'+ds+'</small>';
    b.onclick=()=>{applyChoice(o);};box.appendChild(b);
  }
}
function applyChoice(o){
  sfx('click');
  if(o.t==='w')G.weapons[o.k]=(G.weapons[o.k]||0)+1;else if(o.t==='p'){G.passives[o.k]=(G.passives[o.k]||0)+1;const oldMax=G.st.maxHp;calcStats();if(o.k==='hp')G.p.hp+=G.st.maxHp-oldMax;}
  else if(o.t==='heal')G.p.hp=Math.min(G.st.maxHp,G.p.hp+G.st.maxHp*.5);else G.coins+=25;
  calcStats();pendingLv--;
  if(pendingLv>0){$('luTitle').textContent='Ещё уровень!';renderChoices();}
  else{hideAll();state='play';}
}

// ---------- Render ----------
function render(){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#070c12';ctx.fillRect(0,0,cv.width,cv.height);
  if(!G)return;
  const s=DPR*zoom;let sx=0,sy=0;if(shakeT>0&&save.shake){sx=rnd(-6,6)*shakeT*2;sy=rnd(-6,6)*shakeT*2;}
  const cx=cam.x+sx,cy=cam.y+sy,vw=W/zoom,vh=H/zoom,L=cx-vw/2,T=cy-vh/2;
  ctx.setTransform(s,0,0,s,W*DPR/2-cx*s,H*DPR/2-cy*s);
  // floor
  ctx.fillStyle=floorPattern(G.theme);ctx.fillRect(Math.max(0,L),Math.max(0,T),Math.min(WW,L+vw)-Math.max(0,L),Math.min(WH,T+vh)-Math.max(0,T));
  ctx.strokeStyle='#ffd78088';ctx.lineWidth=8;ctx.strokeRect(-4,-4,WW+8,WH+8);ctx.fillStyle='#0a1118';
  // dirt
  const F=FLOORS[G.theme];ctx.fillStyle=F.dirt;
  const x0=Math.max(0,(L/DC|0)-1),x1=Math.min(GW-1,((L+vw)/DC|0)+1),y0=Math.max(0,(T/DC|0)-1),y1=Math.min(GH-1,((T+vh)/DC|0)+1);
  for(let a=x0;a<=x1;a++)for(let b=y0;b<=y1;b++){const v=G.dirt[b*GW+a];if(v<.04)continue;const h=(a*73+b*151)%97/97;ctx.globalAlpha=Math.min(.8,v*.85);
    ctx.beginPath();ctx.ellipse(a*DC+DC/2+(h-.5)*14,b*DC+DC/2+(h*1.7%1-.5)*14,DC*.45+v*12,DC*.35+v*9,h*3,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
  // puddles & hazards
  for(const q of G.puddles){ctx.globalAlpha=Math.min(.5,q.life);ctx.fillStyle='#6fc9ff';ctx.beginPath();ctx.ellipse(q.x,q.y,q.r,q.r*.7,0,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  for(const h of G.hazards){if(h.t<h.warn){const k=h.t/h.warn;ctx.strokeStyle='#ff4a4a';ctx.lineWidth=3;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,TAU);ctx.stroke();ctx.fillStyle='#ff4a4a';ctx.globalAlpha=.25;ctx.beginPath();ctx.arc(h.x,h.y,h.r*k,0,TAU);ctx.fill();}
    else if(!h.visual){ctx.globalAlpha=h.once?.6:.55;ctx.fillStyle=h.col;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,TAU);ctx.fill();}}ctx.globalAlpha=1;
  // laser/dash telegraphs
  const bb=G.boss;if(bb&&bb.act){const A=bb.act;
    if(A.k==='laser'){for(let i=0;i<A.n;i++){const la=A.a+i*TAU/A.n;ctx.strokeStyle=A.t<.9?'#ff4a4a88':'#ff4d8a';ctx.lineWidth=A.t<.9?3:16;ctx.beginPath();ctx.moveTo(bb.x,bb.y);ctx.lineTo(bb.x+Math.cos(la)*950,bb.y+Math.sin(la)*950);ctx.stroke();if(A.t>=.9){ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.stroke();}}}
    if(A.k==='dash'&&A.t<.75){ctx.strokeStyle='#ff4a4a99';ctx.lineWidth=bb.r*1.6;ctx.beginPath();ctx.moveTo(bb.x,bb.y);ctx.lineTo(bb.x+Math.cos(A.a)*460,bb.y+Math.sin(A.a)*460);ctx.stroke();}}
  // gems
  for(const g of G.gems){if(g.x<L-20||g.x>L+vw+20||g.y<T-20||g.y>T+vh+20)continue;drawPickup(g);}
  // entities sorted
  const list=[];for(const q of G.props)if(q.x>L-80&&q.x<L+vw+80&&q.y>T-80&&q.y<T+vh+100)list.push(q);
  for(const e of G.enemies)if(e.x>L-80&&e.x<L+vw+80&&e.y>T-80&&e.y<T+vh+100)list.push(e);
  list.push(G.p);if(G.weapons.arkady)list.push(G.ark);
  list.sort((a,b)=>a.y-b.y);
  for(const o of list){if(o===G.p)drawPlayer();else if(o===G.ark)drawArkady();else if(o.k)drawProp(o);else if(o.boss)drawBoss(o);else drawEnemy(o);}
  // foam bubbles
  if(G.w.foamPts&&G.weapons.foam)for(const [x,y] of G.w.foamPts){const gr=ctx.createRadialGradient(x-4,y-4,2,x,y,14);gr.addColorStop(0,'#fff');gr.addColorStop(1,'#7fe8ffaa');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,14,0,TAU);ctx.fill();}
  if(G.weapons.brush){ctx.strokeStyle='#ffe08a55';ctx.lineWidth=3;ctx.setLineDash([10,8]);ctx.lineDashOffset=-G.t*60;ctx.beginPath();ctx.arc(G.p.x,G.p.y,G.w.brushR,0,TAU);ctx.stroke();ctx.setLineDash([]);}
  if(G.w.steamFx){const f=G.w.steamFx;ctx.fillStyle='#ffffff';ctx.globalAlpha=f.t*1.6;ctx.beginPath();ctx.moveTo(G.p.x,G.p.y);ctx.arc(G.p.x,G.p.y,f.R,f.a-.55,f.a+.55);ctx.closePath();ctx.fill();ctx.globalAlpha=1;}
  // bombs in flight
  for(const b of G.bombs){const k=b.t/b.dur,x=b.sx+(b.tx-b.sx)*k,y=b.sy+(b.ty-b.sy)*k-Math.sin(k*Math.PI)*120;ctx.strokeStyle='#9fe7ff55';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.tx,b.ty,b.R*k,0,TAU);ctx.stroke();ctx.fillStyle='#3aa0ff';ctx.beginPath();ctx.arc(x,y,9,0,TAU);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-3,y-3,3,0,TAU);ctx.fill();}
  // shots
  ctx.fillStyle='#9fe7ff';for(const s2 of G.shots){ctx.beginPath();ctx.ellipse(s2.x,s2.y,s2.r+3,s2.r-1,Math.atan2(s2.vy,s2.vx),0,TAU);ctx.fill();}
  ctx.fillStyle='#fff';for(const s2 of G.shots){ctx.beginPath();ctx.arc(s2.x,s2.y,3,0,TAU);ctx.fill();}
  for(const b of G.bad){ctx.fillStyle=b.col;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();ctx.strokeStyle='#300';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff8';ctx.beginPath();ctx.arc(b.x-2,b.y-2,3,0,TAU);ctx.fill();}
  if(G.wave){const wv=G.wave;ctx.strokeStyle='#bffcff';ctx.globalAlpha=1-wv.r/430;ctx.lineWidth=26;ctx.beginPath();ctx.arc(wv.x,wv.y,wv.r,0,TAU);ctx.stroke();ctx.lineWidth=6;ctx.strokeStyle='#fff';ctx.stroke();ctx.globalAlpha=1;}
  for(const f of G.fx){ctx.globalAlpha=f.life/f.max*(f.ghost?.35:1);ctx.fillStyle=f.col;ctx.beginPath();ctx.arc(f.x,f.y,f.s,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  ctx.font='bold 16px system-ui';ctx.textAlign='center';for(const t of G.texts){ctx.globalAlpha=Math.min(1,t.life*2);ctx.fillStyle='#000';ctx.fillText(t.v,t.x+1,t.y+1);ctx.fillStyle=t.col;ctx.fillText(t.v,t.x,t.y);}ctx.globalAlpha=1;
  if(!G.demo)drawHUD();
}
function drawPickup(g){
  const bob=Math.sin(G.t*5+g.x)*2;
  if(g.k==='xp'){const c=g.v>=20?'#ffd780':g.v>=5?'#7dff9a':'#6fd8ff',r=g.v>=20?9:g.v>=5?7:5;ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(g.x,g.y-r-bob);ctx.lineTo(g.x+r*.8,g.y-bob);ctx.lineTo(g.x,g.y+r-bob);ctx.lineTo(g.x-r*.8,g.y-bob);ctx.fill();}
  else if(g.k==='coin'){ctx.fillStyle='#ffc93c';ctx.beginPath();ctx.arc(g.x,g.y-bob,7,0,TAU);ctx.fill();ctx.strokeStyle='#8a6410';ctx.lineWidth=2;ctx.stroke();}
  else{const ic={heart:'🌯',magnet:'🧲',bomb:'🫧',chest:'🎁'}[g.k];ctx.font='24px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ic,g.x,g.y-bob);ctx.textBaseline='alphabetic';}
}
function drawEnemy(e){
  const sp=getSpr(e.type,(e.anim*4|0)%2,e.flash>0),sz=sp.size*(e.r/ED[e.type].r);
  ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(e.x,e.y+e.r*.85,e.r*.9,e.r*.3,0,0,TAU);ctx.fill();
  const lift=ED[e.type].fly?-8-Math.sin(e.anim*4)*3:0;
  if(e.elite){ctx.strokeStyle='#ffd780';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y+lift,e.r+6+Math.sin(G.t*6)*2,0,TAU);ctx.stroke();}
  if(e.state===1&&(ED[e.type].dash||ED[e.type].blink)){ctx.globalAlpha=.5+Math.sin(G.t*30)*.5;}
  if(ED[e.type].explode&&e.st>0){ctx.fillStyle='#ff4a4a55';ctx.beginPath();ctx.arc(e.x,e.y,60*Math.min(1,e.st/.55),0,TAU);ctx.fill();}
  ctx.save();ctx.translate(e.x,e.y+lift);ctx.scale(e.face,1);ctx.drawImage(sp.c,-sz/2,-sz/2,sz,sz);ctx.restore();ctx.globalAlpha=1;
  if(e.elite){const w=e.r*2;ctx.fillStyle='#000a';ctx.fillRect(e.x-w/2,e.y-e.r-14,w,5);ctx.fillStyle='#ffd780';ctx.fillRect(e.x-w/2,e.y-e.r-14,w*e.hp/e.maxHp,5);}
}
function drawProp(q){
  const x=q.x,y=q.y,r=q.r;ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(x,y+r*.6,r*1.05,r*.45,0,0,TAU);ctx.fill();
  const c=ctx;
  switch(q.k){
   case'planter':c.fillStyle='#8a5a3a';c.beginPath();c.ellipse(x,y+r*.3,r*.8,r*.5,0,0,TAU);c.fill();c.fillStyle='#3f9a4a';for(let i=0;i<6;i++){const a=i/6*TAU+q.s;c.beginPath();c.ellipse(x+Math.cos(a)*r*.4,y-r*.2+Math.sin(a)*r*.25,r*.45,r*.25,a,0,TAU);c.fill();}c.fillStyle='#5fc46a';c.beginPath();c.arc(x,y-r*.35,r*.35,0,TAU);c.fill();break;
   case'rack':c.fillStyle='#d9dde0';c.beginPath();c.roundRect(x-r,y-r*.9,r*2,r*1.5,6);c.fill();c.fillStyle='#8a99a3';c.fillRect(x-r,y-r*.2,r*2,4);const cols=['#e05a5a','#5ac0e0','#f0c040','#7ad06a'];for(let i=0;i<5;i++){c.fillStyle=cols[(i+(q.s*10|0))%4];c.fillRect(x-r+6+i*(r*2-12)/5,y-r*.75,(r*2-12)/5-3,r*.5);}break;
   case'table':c.fillStyle='#6b4a33';c.fillRect(x-3,y-r*.3,6,r*.9);c.fillStyle=q.s>.5?'#e05a5a':'#f0c040';c.beginPath();c.ellipse(x,y-r*.5,r,r*.55,0,0,TAU);c.fill();c.fillStyle='#fff8';c.beginPath();c.ellipse(x,y-r*.5,r*.6,r*.3,0,0,TAU);c.fill();break;
   case'balls':c.fillStyle='#3b6fb0';c.beginPath();c.ellipse(x,y,r,r*.7,0,0,TAU);c.fill();for(let i=0;i<12;i++){c.fillStyle=['#ff6b6b','#ffd166','#06d6a0','#4cc9f0'][i%4];const a=i*2.4+q.s*5,d=(i%4)/4*r*.7;c.beginPath();c.arc(x+Math.cos(a)*d,y-r*.1+Math.sin(a)*d*.6,6,0,TAU);c.fill();}break;
   case'hanger':c.strokeStyle='#c0c8d0';c.lineWidth=4;c.beginPath();c.arc(x,y-r*.2,r*.8,0,TAU);c.stroke();for(let i=0;i<7;i++){const a=i/7*TAU+q.s;c.fillStyle=['#e07aa0','#7aa0e0','#f0f0f0','#3a3a3a'][i%4];c.fillRect(x+Math.cos(a)*r*.8-6,y-r*.2+Math.sin(a)*r*.6-4,12,r*.7);}break;
   case'pillar':c.fillStyle='#7d858d';c.fillRect(x-r*.7,y-r*1.6,r*1.4,r*2);c.fillStyle='#d8b13a';c.fillRect(x-r*.7,y-r*.1,r*1.4,8);c.fillStyle='#1d2228';c.fillRect(x-r*.7,y-r*.1+8,r*1.4,6);c.fillStyle='#9aa2aa';c.fillRect(x-r*.7,y-r*1.6,r*1.4,6);break;
   case'statue':c.fillStyle='#9e8458';c.fillRect(x-r*.8,y,r*1.6,r*.5);c.fillStyle='#c9b07a';c.beginPath();c.moveTo(x-r*.5,y);c.lineTo(x-r*.35,y-r*1.4);c.lineTo(x+r*.35,y-r*1.4);c.lineTo(x+r*.5,y);c.fill();c.fillStyle='#3a6ab0';c.fillRect(x-r*.35,y-r*1.1,r*.7,6);c.fillRect(x-r*.38,y-r*.75,r*.76,6);break;
   case'server':c.fillStyle='#1c2a38';c.fillRect(x-r*.8,y-r*1.4,r*1.6,r*1.9);for(let i=0;i<6;i++){c.fillStyle=(Math.sin(G.t*4+i+q.s*9)>0)?'#46e0f0':'#1d6a74';c.fillRect(x-r*.6,y-r*1.25+i*r*.28,6,4);c.fillStyle='#2a3d50';c.fillRect(x-r*.4,y-r*1.27+i*r*.28,r,r*.18);}break;
  }
}
function drawPlayer(){
  const p=G.p,m=MACHINES[save.machine];if(p.inv>0&&(G.t*20|0)%2&&p.dashT<=0)ctx.globalAlpha=.45;
  ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(p.x,p.y+18,28,9,0,0,TAU);ctx.fill();
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.face,1);const bob=p.moving?Math.sin(G.t*22)*1.2:0;ctx.translate(0,bob);
  // brush disc
  ctx.fillStyle='#2a3a44';ctx.beginPath();ctx.ellipse(10,14,20,6,0,0,TAU);ctx.fill();ctx.strokeStyle='#9fe7ff';ctx.lineWidth=2;for(let i=0;i<4;i++){const a=G.t*18+i*1.57;ctx.beginPath();ctx.moveTo(10,14);ctx.lineTo(10+Math.cos(a)*18,14+Math.sin(a)*5);ctx.stroke();}
  // body
  ctx.fillStyle=shade(m.col,-40);ctx.beginPath();ctx.roundRect(-24,-6,46,20,7);ctx.fill();
  ctx.fillStyle=m.col;ctx.beginPath();ctx.roundRect(-24,-14,46,18,8);ctx.fill();ctx.strokeStyle='#0d1820';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#ffffff55';ctx.fillRect(-18,-12,26,3);
  // tank
  ctx.fillStyle=shade(m.col,30);ctx.beginPath();ctx.roundRect(-24,-30,16,18,4);ctx.fill();ctx.stroke();ctx.fillStyle='#5fc8ff';ctx.fillRect(-21,-24,10,9);
  // wheels
  ctx.fillStyle='#14202a';ctx.beginPath();ctx.arc(-16,14,6,0,TAU);ctx.arc(14,14,6,0,TAU);ctx.fill();
  // Klava eyes
  ctx.fillStyle='#bffcff';ctx.beginPath();ctx.arc(16,-6,3,0,TAU);ctx.arc(9,-6,3,0,TAU);ctx.fill();
  // steering
  ctx.strokeStyle='#14202a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(12,-14);ctx.lineTo(8,-28);ctx.stroke();ctx.beginPath();ctx.ellipse(8,-29,6,2,0,0,TAU);ctx.stroke();
  // Evgeny
  ctx.fillStyle='#2f5aa8';ctx.beginPath();ctx.roundRect(-8,-38,14,24,4);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#2f5aa8';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(2,-32);ctx.lineTo(8,-28);ctx.stroke();
  ctx.fillStyle='#f1c9a5';ctx.beginPath();ctx.arc(-1,-46,9,0,TAU);ctx.fill();ctx.strokeStyle='#0d1820';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#ff8c3a';ctx.beginPath();ctx.arc(-1,-49,9,Math.PI,0);ctx.fill();ctx.fillRect(4,-50,9,3);
  ctx.fillStyle='#0d1820';ctx.beginPath();ctx.arc(3,-45,1.6,0,TAU);ctx.fill();ctx.fillStyle='#7a4a2a';ctx.fillRect(0,-41,6,2);
  ctx.restore();ctx.globalAlpha=1;
}
function drawArkady(){
  const a=G.ark;ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.a);
  ctx.strokeStyle='#3a2414';ctx.lineWidth=1.5;for(let i=-1;i<=1;i++){const w=Math.sin(G.t*30+i)*3;ctx.beginPath();ctx.moveTo(i*4,0);ctx.lineTo(i*4+w,-9);ctx.moveTo(i*4,0);ctx.lineTo(i*4-w,9);ctx.stroke();}
  ctx.fillStyle='#8a5530';ctx.beginPath();ctx.ellipse(0,0,10,6,0,0,TAU);ctx.fill();ctx.fillStyle='#6a3d1f';ctx.beginPath();ctx.arc(10,0,4,0,TAU);ctx.fill();
  ctx.strokeStyle='#3a2414';ctx.beginPath();ctx.moveTo(13,-1);ctx.quadraticCurveTo(22,-10,26,-4);ctx.moveTo(13,1);ctx.quadraticCurveTo(22,10,26,4);ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(11,-2,1.5,0,TAU);ctx.arc(11,2,1.5,0,TAU);ctx.fill();ctx.restore();
}
function drawBoss(b){
  const r=b.r,t=b.anim;ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(b.x,b.y+r*.85,r*(1-b.z/300),r*.32,0,0,TAU);ctx.fill();
  ctx.save();ctx.translate(b.x,b.y-b.z);if(b.intro>0){ctx.globalAlpha=1-b.intro/1.2;ctx.scale(1+b.intro*.3,1+b.intro*.3);}
  if(b.act&&b.act.k==='blink'&&!b.act.done)ctx.globalAlpha=Math.max(0,1-b.act.t/.6);
  if(b.flash>0)ctx.filter='brightness(2.2)';
  ctx.scale(b.face,1);const c=ctx;c.lineWidth=3;c.strokeStyle='#0d1820';
  const ey=(x,y,s,col)=>{c.fillStyle='#fff';c.beginPath();c.arc(x,y,s,0,TAU);c.fill();c.fillStyle=col||'#14202a';c.beginPath();c.arc(x+s*.3,y+s*.15,s*.5,0,TAU);c.fill();};
  switch(b.key){
   case'soda':{const w=Math.sin(t*4)*3;c.fillStyle='#8a4a1a';c.beginPath();c.moveTo(-r-w,r*.7);c.quadraticCurveTo(-r-w,-r*.9,0,-r*.9);c.quadraticCurveTo(r+w,-r*.9,r+w,r*.7);c.quadraticCurveTo(0,r*1.1,-r-w,r*.7);c.fill();c.stroke();
     c.fillStyle='#ffffff55';for(let i=0;i<7;i++){const yy=((t*40+i*30)%(r*1.4));c.beginPath();c.arc(-r*.6+i*r*.2,r*.6-yy,3+i%3,0,TAU);c.fill();}
     c.fillStyle='#ffd23f';c.beginPath();c.moveTo(-r*.5,-r*.8);c.lineTo(-r*.55,-r*1.25);c.lineTo(-r*.25,-r*1.05);c.lineTo(0,-r*1.35);c.lineTo(r*.25,-r*1.05);c.lineTo(r*.55,-r*1.25);c.lineTo(r*.5,-r*.8);c.closePath();c.fill();c.stroke();
     c.fillStyle='#e0303a';c.beginPath();c.arc(0,-r*.98,5,0,TAU);c.fill();
     c.fillStyle='#fff';c.save();c.translate(r*.7,-r*.5);c.rotate(.5);c.fillRect(-4,-r*.8,8,r*.8);c.fillStyle='#e0303a';for(let i=0;i<4;i++)c.fillRect(-4,-r*.8+i*r*.2,8,r*.1);c.restore();
     ey(-r*.3,-r*.2,r*.17);ey(r*.3,-r*.2,r*.17);c.strokeStyle='#14202a';c.lineWidth=4;c.beginPath();c.arc(0,r*.25,r*.25,.2,Math.PI-.2);c.stroke();break;}
   case'till':{c.fillStyle='#4a6a8a';c.beginPath();c.roundRect(-r,-r*.6,r*2,r*1.4,10);c.fill();c.stroke();c.fillStyle='#1a2a20';c.fillRect(-r*.7,-r*1.05,r*1.4,r*.5);c.strokeRect(-r*.7,-r*1.05,r*1.4,r*.5);
     c.fillStyle='#ff3a3a';c.fillRect(-r*.5,-r*.92,r*.3,r*.2);c.fillRect(r*.2,-r*.92,r*.3,r*.2);
     c.fillStyle='#2a3a4a';c.fillRect(-r*.8,r*.15,r*1.6,r*.5);c.fillStyle='#fff';for(let i=0;i<7;i++){c.beginPath();c.moveTo(-r*.8+i*r*.23,r*.15);c.lineTo(-r*.68+i*r*.23,r*.33);c.lineTo(-r*.57+i*r*.23,r*.15);c.fill();}
     c.fillStyle='#ffc93c';c.beginPath();c.arc(-r*.3,r*.5,6,0,TAU);c.arc(r*.2,r*.55,6,0,TAU);c.fill();
     c.fillStyle='#f4f4ee';c.beginPath();c.moveTo(r*.3,r*.6);for(let i=0;i<6;i++)c.lineTo(r*.3+Math.sin(t*6+i)*6+i*3,r*.6+i*10);c.lineTo(r*.5+15,r*.6+50);c.lineTo(r*.55,r*.6);c.fill();
     c.fillStyle='#8aa0b8';for(let i=0;i<4;i++)for(let j=0;j<2;j++)c.fillRect(-r*.7+i*r*.36,-r*.45+j*r*.25,r*.25,r*.16);break;}
   case'fryer':{c.fillStyle='#ffd23f';for(let i=0;i<9;i++){c.save();c.translate(-r*.7+i*r*.18,-r*.6);c.rotate(Math.sin(t*3+i)*.2-.1+i*.02);c.fillRect(-4,-r*.7,8,r*.7);c.strokeRect(-4,-r*.7,8,r*.7);c.restore();}
     c.fillStyle='#a8b4bc';c.beginPath();c.roundRect(-r,-r*.65,r*2,r*1.5,12);c.fill();c.stroke();c.strokeStyle='#6a7880';c.lineWidth=2;for(let i=1;i<6;i++){c.beginPath();c.moveTo(-r+i*r/3,-r*.65);c.lineTo(-r+i*r/3,r*.85);c.stroke();}
     c.strokeStyle='#0d1820';c.lineWidth=8;c.beginPath();c.moveTo(-r,0);c.lineTo(-r*1.6,-r*.2);c.stroke();
     ey(-r*.35,-r*.1,r*.18,'#c03000');ey(r*.35,-r*.1,r*.18,'#c03000');c.strokeStyle='#14202a';c.lineWidth=5;c.beginPath();c.moveTo(-r*.6,-r*.4);c.lineTo(-r*.15,-r*.25);c.moveTo(r*.6,-r*.4);c.lineTo(r*.15,-r*.25);c.stroke();
     c.fillStyle='#ffcf3a';for(let i=0;i<3;i++){c.beginPath();c.ellipse(-r*.5+i*r*.5,r*.9+((t*50+i*20)%25),4,7,0,0,TAU);c.fill();}break;}
   case'claw':{c.fillStyle='#ffc93c';c.fillRect(-r,-r*1.1,r*2,r*.3);c.strokeRect(-r,-r*1.1,r*2,r*.3);c.fillStyle='#bfe6ff44';c.fillRect(-r*.9,-r*.8,r*1.8,r*1.4);c.strokeRect(-r*.9,-r*.8,r*1.8,r*1.4);
     for(let i=0;i<8;i++){c.fillStyle=['#e7a2c4','#a2c4e7','#c4e7a2','#e7d2a2'][i%4];c.beginPath();c.arc(-r*.7+(i%4)*r*.45,r*.4-(i>>2)*r*.3,r*.2,0,TAU);c.fill();}
     const cx2=Math.sin(t*1.5)*r*.5;c.strokeStyle='#888';c.lineWidth=3;c.beginPath();c.moveTo(cx2,-r*.8);c.lineTo(cx2,-r*.2);c.moveTo(cx2,-r*.2);c.lineTo(cx2-12,-r*.05);c.moveTo(cx2,-r*.2);c.lineTo(cx2+12,-r*.05);c.moveTo(cx2,-r*.2);c.lineTo(cx2,-r*.02);c.stroke();
     c.fillStyle=(t*4|0)%2?'#ff4fa0':'#fff';c.beginPath();c.arc(-r*.5,-r*.95,6,0,TAU);c.arc(r*.5,-r*.95,6,0,TAU);c.fill();c.fillStyle='#d03a2a';c.fillRect(-r*.9,r*.6,r*1.8,r*.3);c.strokeRect(-r*.9,r*.6,r*1.8,r*.3);break;}
   case'manq':{c.fillStyle='#9a8a78';c.fillRect(-4,r*.3,8,r*.7);c.fillRect(-r*.4,r*.95,r*.8,8);c.fillStyle='#efe2cc';c.beginPath();c.moveTo(-r*.9,-r*.35);c.quadraticCurveTo(0,-r*.6,r*.9,-r*.35);c.lineTo(r*.5,r*.4);c.lineTo(-r*.5,r*.4);c.closePath();c.fill();c.stroke();
     c.fillRect(-6,-r*.75,12,r*.3);c.beginPath();c.ellipse(0,-r*1.05,r*.38,r*.45,Math.sin(t*2)*.1,0,TAU);c.fill();c.stroke();c.fillStyle='#0001';c.beginPath();c.ellipse(r*.1,-r*1.0,r*.2,r*.3,0,0,TAU);c.fill();
     c.strokeStyle='#ffd23f';c.lineWidth=5;c.beginPath();c.moveTo(-r*.5,-r*.4);c.quadraticCurveTo(0,-r*.15,r*.5,-r*.4);c.lineTo(r*.45,r*.1);c.stroke();break;}
   case'titan':{c.fillStyle='#14202a';c.beginPath();c.arc(-r*.6,r*.85,10,0,TAU);c.arc(r*.6,r*.85,10,0,TAU);c.fill();c.fillStyle='#3f7a4a';c.beginPath();c.roundRect(-r,-r*.4,r*2,r*1.25,8);c.fill();c.stroke();
     c.fillStyle='#0a0a08';c.fillRect(-r*.95,-r*.4,r*1.9,r*.35);c.fillStyle='#ffe46b';c.beginPath();c.arc(-r*.35,-r*.25,6,0,TAU);c.arc(r*.35,-r*.25,6,0,TAU);c.fill();
     c.fillStyle='#fff';for(let i=0;i<8;i++){c.beginPath();c.moveTo(-r*.9+i*r*.24,-r*.4);c.lineTo(-r*.78+i*r*.24,-r*.2);c.lineTo(-r*.66+i*r*.24,-r*.4);c.fill();}
     c.save();c.translate(0,-r*.42);c.rotate(-.35-Math.sin(t*3)*.12);c.fillStyle='#2f6a3a';c.fillRect(-r*1.05,-r*.25,r*2.1,r*.25);c.strokeRect(-r*1.05,-r*.25,r*2.1,r*.25);c.restore();
     c.fillStyle='#ffe066';c.beginPath();c.ellipse(-r*.4,-r*.8,14,6,.5,0,TAU);c.fill();c.fillStyle='#c0c0c0';c.fillRect(r*.3,-r*.95,12,18);
     c.fillStyle='#2f6a3a';c.fillRect(-r*.9,r*.1,r*1.8,6);break;}
   case'guard':{c.fillStyle='#d8b05a';c.beginPath();c.moveTo(-r*.55,-r*1.1);c.lineTo(r*.55,-r*1.1);c.lineTo(r*.75,r*.2);c.lineTo(r*.5,r*1);c.lineTo(-r*.5,r*1);c.lineTo(-r*.75,r*.2);c.closePath();c.fill();c.stroke();
     c.fillStyle='#2a5aa8';for(let i=0;i<5;i++)c.fillRect(-r*.65,-r*.6+i*r*.3,r*1.3,r*.1);
     c.fillStyle='#d8b05a';c.beginPath();c.moveTo(-r*.95,-r*.7);c.lineTo(-r*.4,-r*1.15);c.lineTo(r*.4,-r*1.15);c.lineTo(r*.95,-r*.7);c.lineTo(r*.6,-r*.2);c.lineTo(-r*.6,-r*.2);c.closePath();c.fill();c.stroke();
     c.fillStyle='#2a5aa8';c.fillRect(-r*.9,-r*.62,r*.3,r*.08);c.fillRect(r*.6,-r*.62,r*.3,r*.08);
     c.fillStyle='#f0d898';c.beginPath();c.ellipse(0,-r*.62,r*.33,r*.4,0,0,TAU);c.fill();c.stroke();
     c.fillStyle='#46f0ff';c.shadowColor='#46f0ff';c.shadowBlur=12;c.beginPath();c.ellipse(-r*.13,-r*.68,5,3,0,0,TAU);c.ellipse(r*.13,-r*.68,5,3,0,0,TAU);c.fill();c.shadowBlur=0;
     c.fillStyle='#c9b07a77';for(let i=0;i<6;i++){c.beginPath();c.arc(Math.cos(t*2+i)*r*1.2,Math.sin(t*2+i)*r*.6+r*.4,4,0,TAU);c.fill();}break;}
   case'core':{const fl=Math.sin(t*20)>.93;for(let i=0;i<4;i++){const a=t*1.4+i*Math.PI/2;c.fillStyle='#ff4d8a';c.beginPath();c.arc(Math.cos(a)*r*1.35,Math.sin(a)*r*.8,8,0,TAU);c.fill();}
     c.fillStyle='#d8b05a';c.beginPath();c.moveTo(-r*.6,-r*.6);c.lineTo(-r*1.05,r*.7);c.lineTo(-r*.55,r*.7);c.closePath();c.moveTo(r*.6,-r*.6);c.lineTo(r*1.05,r*.7);c.lineTo(r*.55,r*.7);c.closePath();c.fill();c.stroke();
     c.fillStyle='#2a5aa8';for(let i=0;i<4;i++){const yy=-r*.3+i*r*.25;c.fillRect(-r*(.7+i*.08),yy,r*.15,r*.08);c.fillRect(r*(.55+i*.08),yy,r*.15,r*.08);}
     c.fillStyle='#1a2230';c.beginPath();for(let i=0;i<6;i++){const a=i/6*TAU+Math.PI/6;c.lineTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8);}c.closePath();c.fill();c.strokeStyle='#46e0f0';c.stroke();
     c.fillStyle='#d8b05a';c.fillRect(-r*.6,-r*.85,r*1.2,r*.18);
     const gr=c.createRadialGradient(0,0,2,0,0,r*.45);gr.addColorStop(0,'#fff');gr.addColorStop(.3,'#46e0f0');gr.addColorStop(1,'#0a3a50');c.fillStyle=gr;c.beginPath();c.arc(0,0,r*.42,0,TAU);c.fill();
     c.fillStyle='#ff2a5a';c.beginPath();c.ellipse(Math.cos(t)*4,0,r*.08,r*.2,0,0,TAU);c.fill();
     if(fl){c.fillStyle='#46e0f088';c.fillRect(-r,rnd(-r,r),r*2,4);}break;}
  }
  c.filter='none';ctx.restore();ctx.globalAlpha=1;
}
// ---------- HUD ----------
const BTN={foam:{x:0,y:0,r:50},dash:{x:0,y:0,r:34},pause:{x:0,y:0,r:24}};
function layoutButtons(){BTN.foam.x=W-80;BTN.foam.y=H-80;BTN.dash.x=W-185;BTN.dash.y=H-55;BTN.pause.x=W-36;BTN.pause.y=36;}
function drawHUD(){
  ctx.setTransform(DPR,0,0,DPR,0,0);layoutButtons();const p=G.p,st=G.st;
  if(p.hp/st.maxHp<.3){const g=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.8);g.addColorStop(0,'#0000');g.addColorStop(1,'rgba(255,40,40,'+(.25+Math.sin(G.t*6)*.1)+')');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
  // xp bar
  ctx.fillStyle='#0009';ctx.fillRect(0,0,W,8);ctx.fillStyle='#6fd8ff';ctx.fillRect(0,0,W*G.xp/G.xpNext,8);
  // hp
  ctx.fillStyle='#000a';rr(14,16,200,16,6);ctx.fill();ctx.fillStyle=p.hp/st.maxHp<.3?'#ff5a5a':'#5fe08a';rr(14,16,200*Math.max(0,p.hp)/st.maxHp,16,6);ctx.fill();
  ctx.font='bold 12px system-ui';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.fillText('❤ '+Math.ceil(Math.max(0,p.hp))+' / '+Math.round(st.maxHp),20,28);
  ctx.font='bold 13px system-ui';ctx.fillStyle='#ffd780';ctx.fillText('УР. '+G.lvl,14,50);ctx.fillStyle='#ffc93c';ctx.fillText('● '+G.coins,70,50);ctx.fillStyle='#d0dfe3';ctx.fillText('☠ '+G.kills,130,50);
  ctx.fillStyle='#9fd9ff';ctx.fillText('🧽 Чистота '+cleanliness()+'%',14,70);
  // weapons icons
  ctx.font='16px system-ui';let ix=14;for(const k in G.weapons){ctx.fillText(WEAP[k].ic,ix,92);ctx.font='bold 10px system-ui';ctx.fillStyle='#ffd780';ctx.fillText(G.weapons[k],ix+18,92);ctx.font='16px system-ui';ctx.fillStyle='#fff';ix+=32;}
  // timer / boss
  ctx.textAlign='center';
  if(G.boss){const b=G.boss,w=Math.min(420,W*.45);ctx.font='bold 13px system-ui';ctx.fillStyle='#ffe0d6';ctx.fillText(b.name,W/2,26);ctx.fillStyle='#000a';rr(W/2-w/2,32,w,12,5);ctx.fill();ctx.fillStyle='#ee5a6a';rr(W/2-w/2,32,w*Math.max(0,b.hp)/b.maxHp,12,5);ctx.fill();}
  else{const tt=G.endless?G.t:Math.max(0,FLOOR_TIME-G.t),mm=Math.floor(tt/60),ss=Math.floor(tt%60);ctx.font='bold 22px system-ui';ctx.fillStyle='#000';ctx.fillText(mm+':'+String(ss).padStart(2,'0'),W/2+1,35);ctx.fillStyle=G.bossDone?'#77e5d1':'#fff';ctx.fillText(G.bossDone?'ЧИСТО!':mm+':'+String(ss).padStart(2,'0'),W/2,34);
    ctx.font='11px system-ui';ctx.fillStyle='#a5bac1';ctx.fillText(G.endless?'БЕСКОНЕЧНАЯ СМЕНА':(G.bossDone?'':'до босса · ')+FLOORS[G.floor].name,W/2,50);}
  // boss arrow
  if(G.boss){const b=G.boss,dx=(b.x-cam.x)*zoom,dy=(b.y-cam.y)*zoom;if(Math.abs(dx)>W/2-30||Math.abs(dy)>H/2-30){const a=Math.atan2(dy,dx),ex=W/2+Math.cos(a)*Math.min(W/2-40,H/2-40)*1.2,ey=H/2+Math.sin(a)*(H/2-40);
    ctx.save();ctx.translate(clamp(ex,40,W-40),clamp(ey,60,H-40));ctx.rotate(a);ctx.fillStyle='#ee5a6a';ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-10,-11);ctx.lineTo(-10,11);ctx.fill();ctx.restore();}}
  // buttons
  const f=BTN.foam,full=G.clean>=100;ctx.fillStyle='#0b1a26cc';ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,TAU);ctx.fill();
  ctx.strokeStyle=full?'#bffcff':'#77e5d1';ctx.lineWidth=6;ctx.beginPath();ctx.arc(f.x,f.y,f.r-4,-Math.PI/2,-Math.PI/2+TAU*G.clean/100);ctx.stroke();
  if(full){ctx.fillStyle='rgba(191,252,255,'+(.25+Math.sin(G.t*8)*.15)+')';ctx.beginPath();ctx.arc(f.x,f.y,f.r-8,0,TAU);ctx.fill();}
  ctx.font='26px system-ui';ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.fillText('🫧',f.x,f.y-6);ctx.font='bold 10px system-ui';ctx.fillText(full?'ПЕНА!':Math.floor(G.clean)+'%',f.x,f.y+20);
  const d=BTN.dash;ctx.fillStyle='#0b1a26cc';ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,TAU);ctx.fill();if(p.dashCd>0){ctx.fillStyle='#ffffff22';ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.arc(d.x,d.y,d.r,-Math.PI/2,-Math.PI/2+TAU*(p.dashCd/2.4));ctx.fill();}
  ctx.strokeStyle='#ffd780';ctx.lineWidth=2;ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,TAU);ctx.stroke();ctx.font='bold 12px system-ui';ctx.fillStyle='#ffd780';ctx.fillText('РЫВОК',d.x,d.y);
  const q=BTN.pause;ctx.fillStyle='#0b1a26cc';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,TAU);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(q.x-7,q.y-8,5,16);ctx.fillRect(q.x+2,q.y-8,5,16);
  ctx.textBaseline='alphabetic';
  if(input.jid!==null){ctx.fillStyle='#ffffff18';ctx.beginPath();ctx.arc(input.jbx,input.jby,60,0,TAU);ctx.fill();ctx.strokeStyle='#ffffff44';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ffffff66';ctx.beginPath();ctx.arc(input.jbx+input.jx*60,input.jby+input.jy*60,26,0,TAU);ctx.fill();}
  else if(G.t<6){ctx.font='14px system-ui';ctx.fillStyle='#ffffffaa';ctx.fillText('◀ Ведите пальцем слева, чтобы ехать ▶',W*.25,H-40);}
  if(toastT>0){ctx.globalAlpha=Math.min(1,toastT*2);ctx.font='bold 15px system-ui';const tw=ctx.measureText(toastMsg).width+30;ctx.fillStyle='#102331ee';rr(W/2-tw/2,64,tw,32,8);ctx.fill();ctx.strokeStyle='#76cabc';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#e9fff7';ctx.fillText(toastMsg,W/2,85);ctx.globalAlpha=1;}
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,Math.max(0,w),h,Math.min(r,Math.max(0,w)/2));}
let toastMsg='',toastT=0;function toast(m){toastMsg=m;toastT=2.6;}

// ---------- Menu background ----------
function menuBackdrop(dt){
  if(!G||G.demo!==true){newRun(rint(0,7),false);G.demo=true;G.weapons={jet:3,foam:2,arkady:2};calcStats();G.p.hp=9999;}
  G.t+=dt*.0;const p=G.p;const a=performance.now()/2500;input.kx=Math.cos(a);input.ky=Math.sin(a*1.3);
  const keepT=G.t;update(dt);G.t=Math.min(keepT+dt,60);p.hp=9999;input.kx=input.ky=0;
}

// ---------- Flow ----------
const SCREENS=['menu','floors','shop','garage','help','settings','levelup','pause','result','dialog'];
function hideAll(){SCREENS.forEach(s=>$(s).classList.add('hidden'));}
function show(id){hideAll();$(id).classList.remove('hidden');}
let backTo='menu';
function toMenu(){state='menu';G=null;show('menu');$('menuCoins').textContent=save.coins;}
function startFloor(i,endless){
  newRun(i,endless);state='dialog';
  const lines=[];if(!save.intro){lines.push(['Клава','Евгений, тревога. В облаке торгового центра осталась резервная копия ФАРАОНа.'],['Евгений','Мы же его в прошлый раз постирали на девяноста градусах.'],['Клава','Копия называет себя ФАРАОН.bak. Она разводит грязь, и грязь оживает. Убирай её — это заряжает мою пену.'],['Аркадий','…'],['Евгений','Понял. Генеральная уборка. Восемь этажей до утра.']);save.intro=true;persist();}
  if(!endless)lines.push(...FLOORS[i].talk);else lines.push(['Клава','Бесконечная смена. Грязь не кончится никогда. Как и наша зарплата… то есть, как и наш энтузиазм.']);
  dialog(lines,()=>{hideAll();state='play';toast(endless?'∞ Держитесь сколько сможете':'Этаж '+(i+1)+': '+FLOORS[i].name);});
}
let dlgQ=[],dlgDone=null;
function dialog(lines,done){dlgQ=lines.slice();dlgDone=done;show('dialog');nextLine();}
function nextLine(){if(!dlgQ.length){const d=dlgDone;dlgDone=null;d&&d();return;}const [s,t]=dlgQ.shift();$('dlgSpk').textContent=s;$('dlgTxt').textContent=t;drawPortrait(s);sfx('click');}
function drawPortrait(who){
  const c=$('portrait'),g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,152,152);g.fillStyle='#233849';g.fillRect(0,0,152,152);g.translate(76,80);g.scale(2.4,2.4);
  if(who==='Евгений'){g.fillStyle='#2f5aa8';g.beginPath();g.roundRect(-16,8,32,30,6);g.fill();g.fillStyle='#f1c9a5';g.beginPath();g.arc(0,-4,15,0,TAU);g.fill();g.fillStyle='#ff8c3a';g.beginPath();g.arc(0,-9,15,Math.PI,0);g.fill();g.fillRect(8,-11,12,4);g.fillStyle='#0d1820';g.beginPath();g.arc(-5,-2,2,0,TAU);g.arc(6,-2,2,0,TAU);g.fill();g.fillStyle='#7a4a2a';g.fillRect(-5,5,10,2.5);}
  else if(who==='Клава'){g.fillStyle='#3fb7a8';g.beginPath();g.roundRect(-24,-14,48,30,8);g.fill();g.fillStyle='#bffcff';g.beginPath();g.arc(-9,-1,5,0,TAU);g.arc(9,-1,5,0,TAU);g.fill();g.fillStyle='#14202a';g.fillRect(-10,9,20,2);g.fillStyle='#2a3a44';g.beginPath();g.ellipse(0,22,22,6,0,0,TAU);g.fill();}
  else if(who==='Аркадий'){g.rotate(-1.57);g.fillStyle='#8a5530';g.beginPath();g.ellipse(0,0,20,12,0,0,TAU);g.fill();g.fillStyle='#6a3d1f';g.beginPath();g.arc(20,0,8,0,TAU);g.fill();g.strokeStyle='#3a2414';g.lineWidth=2;g.beginPath();g.moveTo(26,-2);g.quadraticCurveTo(40,-16,46,-6);g.moveTo(26,2);g.quadraticCurveTo(40,16,46,6);g.stroke();g.fillStyle='#fff';g.beginPath();g.arc(22,-3,2.5,0,TAU);g.arc(22,3,2.5,0,TAU);g.fill();}
  else {g.fillStyle='#1a2230';g.beginPath();for(let i=0;i<6;i++){const a=i/6*TAU+Math.PI/6;g.lineTo(Math.cos(a)*24,Math.sin(a)*24);}g.fill();g.fillStyle='#46e0f0';g.beginPath();g.arc(0,0,11,0,TAU);g.fill();g.fillStyle='#ff2a5a';g.beginPath();g.ellipse(0,0,3,7,0,0,TAU);g.fill();g.fillStyle='#d8b05a';g.fillRect(-18,-26,36,6);}
}
function pauseGame(){if(state!=='play')return;state='pause';const b=Object.keys(G.weapons).map(k=>WEAP[k].ic+G.weapons[k]).join(' ')+'  '+Object.keys(G.passives).map(k=>PASS[k].ic+G.passives[k]).join(' ');$('pauseBuild').textContent=b;show('pause');}
function endRun(win){
  if(!G||state==='result')return;const F=G.floor,clean=cleanliness();let reward=Math.round(G.coins*G.st.coinGain),bonus=0;
  let title,text,eye;
  if(win){bonus=30+F*15+Math.round(clean*.5*(F+1));const stars=1+(clean>=60?1:0)+(clean>=85?1:0);save.stars[F]=Math.max(save.stars[F]||0,stars);save.unlocked=Math.max(save.unlocked,Math.min(8,F+2));
    eye='Этаж '+(F+1)+' · '+FLOORS[F].name;title=F===7?'ФАРАОН.bak удалён!':'Этаж очищен!';text=F===7?'Евгений вытер последний байт грязи. Клава мигнула: «Смена окончена». Аркадий впервые сказал что-то кроме многоточия — но никто не расслышал.':'★'.repeat(stars)+'☆'.repeat(3-stars)+' — чистота '+clean+'%';sfx('win');}
  else{eye=G.endless?'Бесконечная смена':'Этаж '+(F+1);title='Смена окончена';text=G.endless?'Продержались '+fmtT(G.t)+(G.t>save.bestEndless?' — новый рекорд!':' (рекорд '+fmtT(save.bestEndless)+')'):'Грязь победила… на этот раз. Монеты сохранены — загляните в мастерскую.';sfx('lose');
    if(G.endless){bonus=Math.round(G.t/6);save.bestEndless=Math.max(save.bestEndless,Math.floor(G.t));}}
  save.coins+=reward+bonus;persist();state='result';
  $('resEyebrow').textContent=eye;$('resTitle').textContent=title;$('resText').textContent=text;
  $('resStats').innerHTML=[[fmtT(G.t),'время'],[G.kills,'врагов'],[G.lvl,'уровень'],['+'+(reward+bonus),'монет']].map(a=>'<div><b>'+a[0]+'</b><span>'+a[1]+'</span></div>').join('');
  const acts=$('resActions');acts.innerHTML='';
  const mk=(t,fn,cls)=>{const b=document.createElement('button');b.textContent=t;if(cls)b.className=cls;b.onclick=()=>{sfx('click');fn();};acts.appendChild(b);};
  const fl=G.floor,en=G.endless;
  if(win&&fl<7)mk('Следующий этаж →',()=>startFloor(fl+1,false),'primary');
  mk(win?'Переиграть':'Ещё раз',()=>startFloor(fl,en),win&&fl<7?'':'primary');
  mk('🔧 Мастерская',()=>{G=null;state='menu';backTo='menu';openShop();});mk('В меню',toMenu);
  show('result');
}
const fmtT=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');

function openFloors(){
  const g=$('floorGrid');g.innerHTML='';
  FLOORS.forEach((f,i)=>{const b=document.createElement('button');b.className='fl';const lock=i>=save.unlocked;b.disabled=lock;const s=save.stars[i]||0;
    b.style.borderColor=f.ln;b.innerHTML='<span class="num">'+(i+1)+'</span><b>'+(lock?'🔒 ':'')+f.name+'</b><small>'+f.sub+'<br>Босс: '+BOSSES[f.boss].name+'</small><span class="stars">'+'★'.repeat(s)+'☆'.repeat(3-s)+'</span>';
    b.onclick=()=>{sfx('click');audioInit();startFloor(i,false);};g.appendChild(b);});
  coinsUI();show('floors');
}
function coinsUI(){document.querySelectorAll('.cc').forEach(e=>e.textContent=save.coins);$('menuCoins').textContent=save.coins;}
function openShop(){
  const l=$('shopList');l.innerHTML='';
  META.forEach(m=>{const lv=save.meta[m.k]||0,max=lv>=m.max,cost=metaCost(m);const d=document.createElement('div');d.className='item';
    d.innerHTML='<div class="ic">'+m.ic+'</div><div class="tx"><b>'+m.name+'</b><small>'+m.d+'</small><div class="pips">'+Array.from({length:m.max},(_,i)=>'<i class="'+(i<lv?'on':'')+'"></i>').join('')+'</div></div>';
    const b=document.createElement('button');b.textContent=max?'Макс.':'● '+cost;b.disabled=max||save.coins<cost;if(!max&&save.coins>=cost)b.className='primary';
    b.onclick=()=>{save.coins-=cost;save.meta[m.k]=lv+1;persist();sfx('coin');openShop();};d.appendChild(b);l.appendChild(d);});
  coinsUI();show('shop');
}
function openGarage(){
  const l=$('garageList');l.innerHTML='';
  MACHINES.forEach((m,i)=>{const own=save.machines.includes(i),canFloor=!m.floor||save.unlocked>m.floor;const d=document.createElement('div');d.className='item'+(save.machine===i?' sel':'');
    const st=WEAP[m.start].ic+(m.bonus?' '+WEAP[m.bonus].ic:'');
    d.innerHTML='<div class="ic" style="color:'+m.col+'">🚜</div><div class="tx"><b style="color:'+m.col+'">'+m.name+'</b><small>'+m.desc+'<br>❤ '+m.hp+' · ⚡ '+m.speed+' · '+st+'</small></div>';
    const b=document.createElement('button');
    if(own){b.textContent=save.machine===i?'Выбрана':'Выбрать';b.disabled=save.machine===i;b.onclick=()=>{save.machine=i;persist();sfx('click');openGarage();};}
    else if(!canFloor){b.textContent='🔒 Этаж '+m.floor;b.disabled=true;}
    else{b.textContent='● '+m.cost;b.disabled=save.coins<m.cost;if(!b.disabled)b.className='primary';b.onclick=()=>{save.coins-=m.cost;save.machines.push(i);save.machine=i;persist();sfx('coin');openGarage();};}
    d.appendChild(b);l.appendChild(d);});
  coinsUI();show('garage');
}
function openSettings(from){backTo=from;const T=(id,k)=>{const b=$(id);b.textContent=save[k]?'Вкл.':'Выкл.';b.className=save[k]?'primary':'';b.onclick=()=>{save[k]=!save[k];persist();if(k==='music'&&musicGain)musicGain.gain.value=save.music?.14:0;sfx('click');T(id,k);};};
  T('tSound','sound');T('tMusic','music');T('tVibro','vibro');T('tShake','shake');T('tNums','nums');show('settings');}

// ---------- Input ----------
function onDown(e){
  audioInit();
  if(state!=='play')return;
  const x=e.clientX,y=e.clientY,hit=b=>Math.hypot(x-b.x,y-b.y)<b.r+14;
  if(hit(BTN.pause)){pauseGame();return;}
  if(hit(BTN.foam)){foamWave(false);return;}
  if(hit(BTN.dash)){dash();return;}
  if(x<W*.62&&input.jid===null){input.jid=e.pointerId;input.jbx=x;input.jby=y;input.jx=input.jy=0;}
}
function onMove(e){if(e.pointerId!==input.jid)return;let dx=e.clientX-input.jbx,dy=e.clientY-input.jby;const d=Math.hypot(dx,dy);if(d>60){input.jbx+=dx/d*(d-60);input.jby+=dy/d*(d-60);dx=e.clientX-input.jbx;dy=e.clientY-input.jby;}input.jx=dx/60;input.jy=dy/60;}
function onUp(e){if(e.pointerId===input.jid){input.jid=null;input.jx=input.jy=0;}}
cv.addEventListener('pointerdown',onDown);addEventListener('pointermove',onMove);addEventListener('pointerup',onUp);addEventListener('pointercancel',onUp);
function keyAxis(){const k=input.keys;input.kx=(k.ArrowRight||k.KeyD?1:0)-(k.ArrowLeft||k.KeyA?1:0);input.ky=(k.ArrowDown||k.KeyS?1:0)-(k.ArrowUp||k.KeyW?1:0);}
addEventListener('keydown',e=>{audioInit();input.keys[e.code]=true;keyAxis();if(state==='play'){if(e.code==='Space')foamWave(false);if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash();if(e.code==='Escape'||e.code==='KeyP')pauseGame();}else if(state==='pause'&&e.code==='Escape'){hideAll();state='play';}else if(state==='dialog'&&(e.code==='Space'||e.code==='Enter'))nextLine();});
addEventListener('keyup',e=>{input.keys[e.code]=false;keyAxis();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.onAndroidPause=()=>pauseGame();
window.onAndroidBack=()=>{
  if(state==='play'){pauseGame();return;}
  if(state==='pause'){hideAll();state='play';return;}
  if(state==='levelup'||state==='dialog'||state==='result')return;
  if(state==='menu'&&$('menu').classList.contains('hidden')){toMenu();return;}
  if(state==='menu'&&Bridge&&Bridge.exit)Bridge.exit();
};
$('dialog').addEventListener('pointerdown',e=>{e.preventDefault();nextLine();});

// buttons
const on=(id,fn)=>$(id).addEventListener('click',()=>{audioInit();sfx('click');fn();});
on('bPlay',openFloors);
on('bEndless',()=>{if(save.unlocked<4){toastMenu('Откроется после 3-го этажа');return;}startFloor(rint(0,save.unlocked-1),true);});
on('bShop',()=>{backTo='menu';openShop();});on('bGarage',openGarage);on('bHelp',()=>show('help'));on('bSettings',()=>openSettings('menu'));
on('settingsBack',()=>{if(backTo==='pause'){show('pause');}else toMenu();});
on('bResume',()=>{hideAll();state='play';});on('bPauseSettings',()=>openSettings('pause'));on('bQuit',()=>{state='play';endRun(false);});
on('luReroll',()=>{if(rerollLeft>0){rerollLeft--;renderChoices();}});
on('bReset',()=>{if(confirm('Сбросить весь прогресс?')){save=Object.assign({},DEF,{meta:{},stars:[0,0,0,0,0,0,0,0],machines:[0]});persist();toMenu();}});
document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>{sfx('click');toMenu();}));
function toastMenu(m){const b=$('bEndless');const o=b.textContent;b.textContent='🔒 '+m;setTimeout(()=>b.textContent=o,1800);}

// ---------- Loop ----------
function loop(t){
  const dt=Math.min(.05,(t-lastT)/1000||0);lastT=t;
  try{
    if(state==='play'&&G){update(dt);}
    else if(state==='menu'){menuBackdrop(dt);}
    shakeT=Math.max(0,shakeT-dt);toastT-=dt;
    render();
    if(state==='menu'&&G){ctx.setTransform(1,0,0,1,0,0);}
  }catch(err){console.error(err);}
  requestAnimationFrame(loop);
}
resize();
$('loading').classList.add('hidden');
if(save.unlocked>=4)$('bEndless').textContent='∞ Бесконечная смена'+(save.bestEndless?' ('+fmtT(save.bestEndless)+')':'');
toMenu();
requestAnimationFrame(loop);
