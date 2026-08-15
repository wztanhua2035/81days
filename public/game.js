(() => {
  'use strict';

  const D = window.DAY81_DATA;
  const NPC = window.DAY81_NPC;
  const SAVE = 'day81_save_v4';
  const ACH = 'day81_achievements_v1';
  const SOUND_KEY = 'day81_sound';
  const app = document.getElementById('app');

  const DEFAULT_GAME_CONFIG = {
    roleNames: {linlan:'林岚',zhouye:'周野',chenmo:'陈默',suqing:'苏晴',gaoyuan:'高远',xutang:'许棠'},
    difficulty: {nightEventChance:.70,baseCheckModifier:0,avoidChance:.20,healthDecayChance:1,healthyLifeRecoverChance:.20,inventoryLimit:4,startingBonusFood:0}
  };

  const DIFFICULTY_META = {
    easy:   {label:'容易',desc:'更高检定与躲避成功率，夜间事件较少，并额外获得食物。'},
    normal: {label:'正常',desc:'推荐难度。夜间特别事件默认70%，资源和风险相对均衡。'},
    hard:   {label:'困难',desc:'检定更苛刻、夜晚更危险，恢复机会更少。'}
  };

  let GAME_CONFIG = JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG));
  let state = null;
  let lastTypedKey = '';
  let audioCtx = null;
  let soundEnabled = localStorage.getItem(SOUND_KEY) !== '0';

  function rules(){ return state?.rules || GAME_CONFIG.difficulty; }
  function invLimit(c){ return Number(c?.inventoryLimit || rules().inventoryLimit || 4); }
  function applyNamesToCharacters(chars){ for(const c of chars||[]){ const n=GAME_CONFIG.roleNames?.[c.id]; if(n) c.name=n; } }
  function hashSeed(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function randStep(a){ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return [a,((t^(t>>>14))>>>0)/4294967296]; }
  function rng(){ const [a,v]=randStep(state.rngState>>>0); state.rngState=a; return v; }
  function chance(p){ return rng()<p; }
  function rand(arr){ return arr[Math.floor(rng()*arr.length)]; }
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function esc(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function regexEsc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function pairKey(a,b){ return [a,b].sort().join('|'); }
  function alive(){ return state.characters.filter(c=>!c.dead); }
  function player(){ return state.characters.find(c=>c.id===state.playerId); }
  function cBy(id){ return state.characters.find(c=>c.id===id); }
  function has(c,id){ return c.inventory.includes(id); }
  function item(id){ return D.items[id]; }
  function locationById(id){ return D.locations.find(x=>x.id===id); }
  function stageInfo(day=state.day){ if(day<=20)return['初到荒岛',1]; if(day<=40)return['生存',2]; if(day<=60)return['消耗',3]; return['最后的等待',4]; }
  function save(){ if(!state)return; try{ localStorage.setItem(SAVE,JSON.stringify(state)); }catch(e){ console.warn('save failed',e); } }
  function load(){
    try{
      const x=JSON.parse(localStorage.getItem(SAVE)||'null');
      if(x&&x.version===4){
        x.rules={...DEFAULT_GAME_CONFIG.difficulty,...(x.rules||GAME_CONFIG.difficulty)};
        x.exploredLocations=x.exploredLocations||{};
        x.morningEncounter=x.morningEncounter||null;
        x.leaderboard=x.leaderboard||{submitted:false};
        x.camp=x.camp||{locationId:'bamboo_clearing',materials:{wood:0,fiber:0,scrap:0},buildings:{},storedFood:0,storedWater:0,lastFoodDay:0,lastWaterDay:0};
        x.stories=x.stories||Object.fromEntries((D.storyChains||[]).map(s=>[s.id,{started:false,step:0,nextDay:0,completed:false,branch:''}]));
        x.crises=x.crises||[];
        x.crisisNotice=x.crisisNotice||null;
        applyNamesToCharacters(x.characters);
        x.characters.forEach(c=>c.inventoryLimit=x.rules.inventoryLimit);
        return x;
      }
    }catch(e){}
    return null;
  }
  function log(msg){ state.history.push({day:state.day,msg}); if(state.history.length>150) state.history.splice(0,state.history.length-150); }
  function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1800); }


  function portrait(c,cls='portraitSm'){ return `<img class="${cls}" src="${esc(c.portrait||'')}" alt="${esc(c.name)}头像" loading="lazy">`; }
  function relationScore(a,b){
    if(!a||!b||a.id===b.id)return 0;
    const v=state.relationships[pairKey(a.id,b.id)];
    if(typeof v==='number')return v;
    if(v==='enemy')return -100;
    return 0;
  }
  function changeRelation(a,b,delta,reason=''){
    if(!a||!b||a.id===b.id||!delta)return;
    const k=pairKey(a.id,b.id),before=relationScore(a,b),after=clamp(before+delta,-100,100);
    state.relationships[k]=after;
    if((a.id===state.playerId||b.id===state.playerId)&&Math.abs(after-before)>=5){
      const other=a.id===state.playerId?b:a;
      log(`${other.name}与你的关系${delta>0?'改善':'恶化'}${reason?`：${reason}`:''}`);
    }
  }
  function relationLabel(a,b){const s=relationScore(a,b);if(s<=-50)return'敌对';if(s<=-20)return'冷淡';if(s<25)return'普通';if(s<60)return'信任';return'生死之交';}
  function relationClass(a,b){const s=relationScore(a,b);return s<=-20?'relBad':s>=25?'relGood':'relNormal';}
  function randomOther(c){const list=alive().filter(x=>x.id!==c.id);return list.length?rand(list):null;}

  function camp(){return state.camp;}
  function addCampMaterial(mat){
    if(!mat)return;
    const labels={wood:'木材',fiber:'藤条',scrap:'零件'};
    const gains=[];
    for(const [k,v] of Object.entries(mat)){if(!camp().materials[k])camp().materials[k]=0;camp().materials[k]+=v;gains.push(`${labels[k]||k}+${v}`);}
    if(gains.length)toast(`营地材料：${gains.join('、')}`);
  }
  function canBuild(b){return Object.entries(b.cost||{}).every(([k,v])=>(camp().materials[k]||0)>=v);}
  function buildCamp(id){
    const p=player(),b=(D.campBuildings||[]).find(x=>x.id===id);if(!b)return;
    if(p.locationId!==camp().locationId){toast('只有到林中空地才能建设营地');return;}
    if(camp().buildings[id]){toast('该设施已经建成');return;}
    if(!canBuild(b)){toast('营地材料不足');return;}
    for(const [k,v] of Object.entries(b.cost||{}))camp().materials[k]-=v;
    camp().buildings[id]=true;
    if(id==='rescue_tower')state.rescueScore+=2;
    log(`营地建成：${b.name}`);sound('good');save();showCamp();
  }
  function campProduction(){
    const c=camp();
    if(c.buildings.water_collector&&state.day-c.lastWaterDay>=3){c.storedWater++;c.lastWaterDay=state.day;log('集水器收集到一份净水。');}
    if(c.buildings.fish_trap&&state.day-c.lastFoodDay>=4){c.storedFood++;c.lastFoodDay=state.day;log('捕鱼陷阱捕到一份食物。');}
  }
  function claimCamp(kind){
    if(player().locationId!==camp().locationId){toast('需要回到林中空地才能领取');return;}
    if(kind==='water'&&camp().storedWater>0){camp().storedWater--;addHealth(player(),1);toast('饮用营地净水，健康+1');}
    else if(kind==='food'&&camp().storedFood>0){camp().storedFood--;gainItem(player(),'grilled_fish','营地领取');}
    else toast('暂时没有可领取物资');
    save();showCamp();
  }
  function campProtection(c,type){
    if(c.locationId!==camp().locationId)return false;
    if(type==='rain'&&camp().buildings.shelter)return true;
    if(type==='heat'&&camp().buildings.water_collector)return true;
    if(type==='beast'&&camp().buildings.shelter)return true;
    return false;
  }

  function generateCrises(rs){
    const crises=[];let cur=rs;
    for(const t of (D.crisisTemplates||[])){
      let v;[cur,v]=randStep(cur);const day=t.window[0]+Math.floor(v*(t.window[1]-t.window[0]+1));
      crises.push({...t,day,done:false});
    }
    return {crises,rngState:cur};
  }
  function crisisToday(){return (state.crises||[]).find(c=>c.day===state.day&&!c.done)||null;}
  function nearestCrisis(){return (state.crises||[]).filter(c=>!c.done&&c.day>=state.day).sort((a,b)=>a.day-b.day)[0]||null;}
  function updateCrisisNotice(){
    const c=nearestCrisis();state.crisisNotice=null;if(!c)return;
    const left=c.day-state.day;if(left>=0&&left<=c.warningDays){state.crisisNotice={...c,left};if(left===c.warningDays&&!c.warned){c.warned=true;log(`危机预警：${c.name}预计${c.warningDays}天后到来。`);setTimeout(()=>toast(`⚠ 危机预警：${c.name}`),120);sound('bad');}}
  }
  function runCrisis(){
    const c=crisisToday();if(!c)return null;c.done=true;const living=alive();let extra=[];
    if(c.id==='tropical_storm'){
      for(const ch of living){if(ch.locationId==='rock_cave'||campProtection(ch,'rain')||has(ch,'tarp')){extra.push(`${ch.name}找到遮蔽，没有受伤`);continue;}if(chance(.42)){healthDamage(ch,1);extra.push(`${ch.name}健康-1`);}}
    }else if(c.id==='heatwave'){
      for(const ch of living){if(ch.locationId==='fresh_stream'||campProtection(ch,'heat')||has(ch,'bottle'))continue;if(chance(.38)){healthDamage(ch,1);extra.push(`${ch.name}因高温健康-1`);}}
    }else if(c.id==='beast_migration'){
      for(const ch of living){if(campProtection(ch,'beast')||has(ch,'torch'))continue;if(chance(.20)){applyDamage(ch,1,'野兽迁徙');extra.push(`${ch.name}生命-1`);}}
    }else if(c.id==='king_tide'){
      const coast=new Set(['crash_beach','moon_bay','reef_pools','cliff_edge']);
      for(const ch of living.filter(x=>coast.has(x.locationId))){if(has(ch,'drybag'))continue;if(chance(.35)){const lost=loseRandomItem(ch);if(lost)extra.push(`${ch.name}失去${item(lost).name}`);else{healthDamage(ch,1);extra.push(`${ch.name}健康-1`);}}}
    }
    sound('bad');log(`大危机发生：${c.name}`);return {title:`${c.icon} ${c.name}`,text:`预告中的大危机终于到来。${extra.length?'\n'+extra.join('；'):'\n大家提前做了准备，顺利撑过了最危险的时刻。'}`,locationId:null,crisis:true};
  }

  function getStoryState(id){return state.stories?.[id];}
  function storyEventForLocation(locationId){
    for(const chain of (D.storyChains||[])){
      const st=getStoryState(chain.id);if(!st||st.completed)continue;
      if(st.started){const step=chain.steps[st.step];if(step&&state.day>=st.nextDay&&step.location===locationId)return {...step,id:`story_${chain.id}_${st.step}`,type:'choice',location:step.location,storyChain:chain.id,storyStep:st.step,storyName:chain.name};}
      else if(state.day>=chain.minDay&&chain.startLocation===locationId&&chance(chain.startChance||.2)){st.started=true;st.step=0;st.nextDay=state.day;const step=chain.steps[0];return {...step,id:`story_${chain.id}_0`,type:'choice',location:step.location,storyChain:chain.id,storyStep:0,storyName:chain.name};}
    }
    return null;
  }
  function advanceStory(e,ch){
    if(!e?.storyChain||!ch?.story)return;
    const chain=(D.storyChains||[]).find(x=>x.id===e.storyChain),st=getStoryState(e.storyChain);if(!chain||!st)return;
    if(ch.story.branch)st.branch=ch.story.branch;
    if(ch.story.complete||st.step>=chain.steps.length-1){st.completed=true;log(`连续剧情完成：${chain.name}`);toast(`剧情完成：${chain.name}`);return;}
    st.step=Math.min(chain.steps.length-1,st.step+(ch.story.advance||1));st.nextDay=state.day+(ch.story.delay||2);log(`连续剧情推进：${chain.name}`);
  }

  function ensureAudio(){
    if(!soundEnabled) return null;
    try{
      if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      return audioCtx;
    }catch{return null;}
  }
  async function unlockAudio(){
    if(!soundEnabled)return;
    const ctx=ensureAudio();if(!ctx)return;
    try{
      if(ctx.state==='suspended')await ctx.resume();
      // iOS/Safari 需要一次由真实触摸手势触发的无声音频，之后程序音效才可靠。
      const buffer=ctx.createBuffer(1,1,22050),src=ctx.createBufferSource(),g=ctx.createGain();
      g.gain.value=.00001;src.buffer=buffer;src.connect(g);g.connect(ctx.destination);src.start(0);
    }catch(e){console.warn('audio unlock failed',e);}
  }
  function playTone(kind){
    const ctx=ensureAudio(); if(!ctx||ctx.state!=='running') return;
    const now=ctx.currentTime, o=ctx.createOscillator(), g=ctx.createGain();
    const map={day:[520,.13,'sine'],card:[680,.07,'triangle'],good:[820,.09,'sine'],bad:[170,.12,'sawtooth'],night:[240,.16,'sine'],encounter:[330,.10,'square'],click:[560,.04,'sine'],build:[470,.14,'triangle'],story:[720,.11,'sine']};
    const [freq,dur,type]=map[kind]||map.click;
    o.type=type;o.frequency.setValueAtTime(freq,now);if(kind==='day'||kind==='story')o.frequency.exponentialRampToValueAtTime(freq*1.35,now+dur);if(kind==='bad')o.frequency.exponentialRampToValueAtTime(100,now+dur);
    g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.05,now+.01);g.gain.exponentialRampToValueAtTime(.0001,now+dur);
    o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+dur+.02);
  }
  function sound(kind){
    const ctx=ensureAudio();if(!ctx)return;
    if(ctx.state==='suspended'){ctx.resume().then(()=>playTone(kind)).catch(()=>{});return;}
    playTone(kind);
  }
  function toggleSound(){ soundEnabled=!soundEnabled; localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0'); if(soundEnabled){unlockAudio();sound('click');} render(); }
  function showStatFx(type,delta){
    if(!state||!delta) return;
    const positive=delta>0, label=type==='life'?'生命':'健康';
    const el=document.createElement('div'); el.className=`statFx ${positive?'plus':'minus'}`; el.innerHTML=`<b>${label}</b> ${positive?'+':''}${delta}`; document.body.appendChild(el); setTimeout(()=>el.remove(),1050); sound(positive?'good':'bad');
  }
  function showDayTransition(){
    const p=player(),loc=locationById(p.locationId),low=p.life<2,cr=state.crisisNotice;
    const crisisLine=cr?`<div class="dayCrisis">${cr.icon} ${esc(cr.name)} · ${cr.left===0?'今晚来临':`${cr.left}天后`}</div>`:'';
    const el=document.createElement('div');el.className='dayTransition';el.innerHTML=`<div class="dayTransitionInner">${portrait(p,'dayPortrait')}<div class="dayBig">DAY ${state.day}</div><div class="dayLoc">${loc?`清晨 · ${esc(loc.name)}`:'新的一天'}</div>${crisisLine}${low?'<div class="lifeWarning">⚠ 生命值低于2 · 情况危险</div>':''}</div>`;document.body.appendChild(el);sound('day');setTimeout(()=>el.classList.add('show'),20);setTimeout(()=>el.classList.remove('show'),1200);setTimeout(()=>el.remove(),1550);
  }
  function richText(text){
    let html=esc(text||'');
    const names=Object.values(D.items).map(x=>x.name).sort((a,b)=>b.length-a.length);
    for(const name of names){ html=html.replace(new RegExp(regexEsc(esc(name)),'g'),`<strong class="itemName">${esc(name)}</strong>`); }
    return html.replace(/\n/g,'<br>');
  }
  function typeText(el,text,done){
    if(!el){ done?.(); return; }
    let i=0; el.textContent=''; const choices=document.getElementById('eventChoices'); if(choices)choices.classList.add('typingLocked');
    const tick=()=>{ if(i>=text.length){ el.innerHTML=richText(text); if(choices)choices.classList.remove('typingLocked'); done?.(); return; } el.textContent+=text[i++]; setTimeout(tick,Math.max(8,Math.min(22,16+(text[i-1]==='。'?20:0)))); };
    tick();
  }

  function difficultyRules(key){
    const b={...DEFAULT_GAME_CONFIG.difficulty,...GAME_CONFIG.difficulty};
    // 整体难度略微下调，但正常难度仍保留70%的夜间特别事件概率。
    if(key==='easy') return {...b,nightEventChance:clamp(b.nightEventChance-.10,.30,.80),baseCheckModifier:clamp(b.baseCheckModifier+.14,-.20,.30),avoidChance:clamp(b.avoidChance+.15,.10,.75),healthDecayChance:clamp(b.healthDecayChance-.22,.45,1),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance+.15,0,.70),startingBonusFood:2};
    if(key==='hard') return {...b,nightEventChance:clamp(b.nightEventChance+.08,.40,.88),baseCheckModifier:clamp(b.baseCheckModifier-.05,-.20,.20),avoidChance:clamp(b.avoidChance-.02,.05,.60),healthDecayChance:clamp(b.healthDecayChance-.02,.75,1),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance-.03,0,.60),startingBonusFood:0};
    return {...b,nightEventChance:b.nightEventChance,baseCheckModifier:clamp(b.baseCheckModifier+.03,-.20,.25),avoidChance:clamp(b.avoidChance+.03,.05,.65),healthDecayChance:clamp(b.healthDecayChance-.05,.55,1),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance+.03,0,.65),startingBonusFood:Math.max(1,b.startingBonusFood||0)};
  }

  function makeChar(base){ return {...base,life:base.maxLife,health:3,inventory:[base.startItem],locationId:null,dead:false,deathDay:null,deathCause:'',healthyStreak:0,abilityCooldown:0,lowLifeSeen:false,skipDecay:false,damageShield:0,generalShield:0,nextCheckBonus:0,dayStartHealth:3,raincoatUsed:false,lifevestUsed:false,stats:{battles:0,wins:0,trades:0,avoids:0,itemsFound:1,itemsUsed:0}}; }
  function newState(playerId,difficultyKey){
    const seed=`${Date.now()}-${Math.random()}`;
    let rs=hashSeed(seed);
    const chars=D.characters.map(makeChar);
    for(const c of chars){ const step=randStep(rs); rs=step[0]; c.locationId=D.locations[Math.floor(step[1]*D.locations.length)].id; }
    const currentRules=difficultyRules(difficultyKey);
    const crisisGen=generateCrises(rs); rs=crisisGen.rngState;
    const s={version:4,seed,rngState:rs,day:1,phase:'PREPARE',playerId,difficultyKey,difficultyLabel:DIFFICULTY_META[difficultyKey]?.label||'正常',characters:chars,rules:currentRules,relationships:{},freeTrades:{},recentPlayerEvents:[],recentNpcEvents:[],currentEvent:null,eventResolved:false,currentResult:'',nightDanger:0,rescueScore:0,history:[],statistics:{battles:0,battleWins:0,trades:0,itemsUsed:0,itemsFound:0,foodUsed:0,risksTaken:0},pending:null,lastNight:null,score:null,selectedLocationId:null,exploredLocations:{},morningEncounter:null,leaderboard:{submitted:false},camp:{locationId:'bamboo_clearing',materials:{wood:0,fiber:0,scrap:0},buildings:{},storedFood:0,storedWater:0,lastFoodDay:0,lastWaterDay:0},stories:Object.fromEntries((D.storyChains||[]).map(s=>[s.id,{started:false,step:0,nextDay:0,completed:false,branch:''}])),crises:crisisGen.crises,crisisNotice:null};
    const bonusFoods=['apple','coconut'].slice(0,currentRules.startingBonusFood||0);
    s.characters.forEach(c=>{ c.inventoryLimit=currentRules.inventoryLimit; for(const id of bonusFoods){ if(c.inventory.length<currentRules.inventoryLimit)c.inventory.push(id); } });
    const pc=s.characters.find(c=>c.id===playerId); s.exploredLocations[pc.locationId]=true;
    return s;
  }

  function addHealth(c,n){ const before=c.health; c.health=clamp(c.health+n,0,3); const d=c.health-before; if(c.id===state?.playerId&&d) showStatFx('health',d); return d; }
  function addLife(c,n){ const before=c.life; c.life=clamp(c.life+n,0,c.maxLife); const d=c.life-before; if(c.id===state?.playerId&&d) showStatFx('life',d); return d; }
  function healthDamage(c,n){ if(n<=0)return 0; if(c.generalShield>0){c.generalShield--;return 0;} const b=c.health;c.health=clamp(c.health-n,0,3);const d=b-c.health;if(c.id===state?.playerId&&d)showStatFx('health',-d);return d; }
  function applyDamage(c,n,cause='受伤'){ if(n<=0)return 0;if(c.generalShield>0){c.generalShield--;return 0;}if(c.damageShield>0){c.damageShield--;return 0;}if(c.id==='zhouye'&&chance(.25))return 0;c.life-=n;if(c.id===state?.playerId)showStatFx('life',-n);if(c.life<=1)c.lowLifeSeen=true;if(c.life<=0)kill(c,cause);return n; }
  function kill(c,cause){ c.life=0;c.dead=true;c.deathDay=state.day;c.deathCause=cause;c.inventory=[];log(`${c.name}在DAY ${state.day}死亡：${cause}`); }
  function breakItem(c,id,reason='损坏'){ if(!has(c,id))return false;if(c.id==='chenmo'&&chance(.35)){log(`${c.name}修好了${item(id).name}`);return false;}c.inventory.splice(c.inventory.indexOf(id),1);log(`${c.name}的${item(id).name}${reason}`);return true; }
  function gainItem(c,id,source='获得'){
    if(!D.items[id])return;
    if(c.inventory.includes(id)&&!item(id).consumable){if(c.id===state.playerId)toast(`已有${item(id).name}，效果不能叠加`);return;}
    if(c.inventory.length<invLimit(c)){c.inventory.push(id);c.stats.itemsFound++;if(c.id===state.playerId){state.statistics.itemsFound++;toast(`${source}：${item(id).name}`);sound('good');}return;}
    if(c.id===state.playerId){state.pending={type:'replace',incoming:id};save();render();return;}
    const discard=NPC.chooseDiscard(c,D,state.day,id);if(discard===id)return;c.inventory.splice(c.inventory.indexOf(discard),1,id);
  }
  function randomItem(filter){ if(filter)return rand(filter);const foodChance=state.day<=20?.56:state.day<=40?.52:state.day<=60?.48:.44;const x=rng();if(x<foodChance)return rand(D.foodPool);if(x<foodChance+.11)return rand(D.medicalPool);return rand(D.itemPool.filter(id=>D.items[id].kind==='gear'||D.items[id].kind==='special')); }
  function highItem(){return rand(D.itemPool.filter(id=>(item(id).value||0)>=8));}

  function useItem(c,id){
    const idx=c.inventory.indexOf(id);if(idx<0)return;const it=item(id);if(!it.consumable)return;if(id==='flare'&&state.day<61){toast('DAY 61以后再使用信号弹更有意义');return;}
    let consumed=true,msg='';
    if(it.effect?.wildFood){if(chance(.75)){addHealth(c,1);msg='野果没问题，健康+1';}else{healthDamage(c,1);msg='野果让你不舒服，健康-1';}}
    else{if(it.effect?.health){let n=it.effect.health;if(it.effect.extraHealthChance&&chance(it.effect.extraHealthChance))n++;addHealth(c,n);msg=`健康+${n}`;}if(it.effect?.life){const n=addLife(c,it.effect.life);msg=`生命+${n}`;}if(it.effect?.skipDecay){c.skipDecay=true;msg+=(msg?'，':'')+'今晚不自然下降健康';}if(it.effect?.shield){c.damageShield+=it.effect.shield;msg='下一次生命伤害将被抵消';}if(it.effect?.generalShield){c.generalShield+=it.effect.generalShield;msg='下一次健康或生命损失将被抵消';}if(it.effect?.rescueScore){state.rescueScore+=it.effect.rescueScore;msg='你在高地打出信号，求救努力+2';}}
    if(c.id==='gaoyuan'&&it.kind==='food'&&chance(.25))consumed=false;if(consumed)c.inventory.splice(idx,1);c.stats.itemsUsed++;if(c.id===state.playerId){state.statistics.itemsUsed++;if(it.kind==='food')state.statistics.foodUsed++;toast(`${it.name}：${msg}${consumed?'':'（没有消耗）'}`);}save();render();
  }

  function checkChance(c,stat,difficulty='normal',tags=[]){
    const base={2:.30,3:.45,4:.60,5:.75}[c[stat]]||.45;let p=base+(difficulty==='easy'?.15:difficulty==='hard'?-.20:0)+(c.nextCheckBonus||0)+(rules().baseCheckModifier||0);
    if(stat==='luck'&&has(c,'coin'))p+=.10;if(tags.includes('climb')&&has(c,'rope'))p+=.25;if(tags.includes('mechanic')&&has(c,'multitool'))p+=.20;if(tags.includes('fish')&&has(c,'fishing'))p+=.30;if(tags.includes('fire')&&has(c,'lighter'))p+=.30;if(tags.includes('resource')&&has(c,'axe'))p+=.20;if(tags.includes('water')&&has(c,'bottle'))p+=.25;if(tags.includes('explore')&&has(c,'oldmap'))p+=.12;
    c.nextCheckBonus=0;p=clamp(p,.10,.95);let ok=chance(p);if(!ok&&c.id==='xutang'){const last=c.lastRetryDay||-99;if(state.day-last>=7){c.lastRetryDay=state.day;ok=chance(p);if(c.id===state.playerId)toast('冷静判断：自动重试一次');}}return ok;
  }

  function applyEffect(c,effect={},context='事件'){
    const msgs=[];if(effect.none)msgs.push('无事发生');if(effect.health){const n=effect.health>0?addHealth(c,effect.health):-healthDamage(c,-effect.health);msgs.push(`健康${n>=0?'+':''}${n}`);}if(effect.life){if(effect.life>0){const n=addLife(c,effect.life);msgs.push(`生命+${n}`);}else{applyDamage(c,-effect.life,context);msgs.push(`生命${effect.life}`);}}if(effect.skipDecay){c.skipDecay=true;msgs.push('今晚不自然下降健康');}if(effect.nextCheckBonus){c.nextCheckBonus=Math.max(c.nextCheckBonus,effect.nextCheckBonus);msgs.push('获得下一次检定加成');}if(effect.item){gainItem(c,effect.item);msgs.push(`获得${item(effect.item).name}`);}if(effect.randomItem){const id=randomItem();gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomHighItem){const id=highItem();gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomFood){const id=randomItem(D.foodPool);gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomFrom){const id=rand(effect.randomFrom);gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomItemChance){if(chance(effect.randomItemChance)){const id=randomItem();gainItem(c,id);msgs.push(`获得${item(id).name}`);}else msgs.push('里面什么也没有');}
    if(effect.pickItems){const choices=[];while(choices.length<effect.pickItems){const id=randomItem();if(!choices.includes(id))choices.push(id);}if(c.id===state.playerId){state.pending={type:'pick',choices};msgs.push(`发现${effect.pickItems}件物资，可选择1件`);}else{const id=[...choices].sort((a,b)=>NPC.itemValue(item(b),c,state.day)-NPC.itemValue(item(a),c,state.day))[0];gainItem(c,id);msgs.push(`获得${item(id).name}`);}}
    if(effect.loseItem){const lost=loseRandomItem(c);msgs.push(lost?`失去${item(lost).name}`:'没有丢失任何道具');}if(effect.loseFood){const foods=c.inventory.filter(id=>item(id).kind==='food');if(foods.length){const id=rand(foods);c.inventory.splice(c.inventory.indexOf(id),1);msgs.push(`${item(id).name}腐坏了`);}else msgs.push('你没有食物可坏');}if(effect.achievement)unlock(effect.achievement);if(effect.rescueScore){state.rescueScore+=effect.rescueScore;msgs.push('求救努力有所增加');}if(effect.nightDanger){state.nightDanger+=effect.nightDanger;msgs.push('今晚危险似乎增加了');}if(effect.fromNpc){const donor=alive().filter(x=>x.id!==c.id&&x.inventory.length);if(donor.length){const d=rand(donor),iid=d.inventory.sort((a,b)=>NPC.itemValue(D.items[a],d,state.day)-NPC.itemValue(D.items[b],d,state.day))[0];d.inventory.splice(d.inventory.indexOf(iid),1);gainItem(c,iid);msgs.push(`${d.name}留下了${item(iid).name}`);}else msgs.push('最后什么也没找到');}if(effect.campMaterial){addCampMaterial(effect.campMaterial);msgs.push('获得营地建设材料');}if(effect.relationTo){const o=cBy(effect.relationTo);if(o){changeRelation(c,o,effect.relation||0,'剧情选择');msgs.push(`与${o.name}关系${(effect.relation||0)>0?'提升':'下降'}`);}}if(effect.relationRandom){const o=randomOther(c);if(o){changeRelation(c,o,effect.relationRandom,'剧情选择');msgs.push(`与${o.name}关系变化`);}}if(effect.relationAll){for(const o of alive().filter(x=>x.id!==c.id))changeRelation(c,o,effect.relationAll,'共同经历');msgs.push('与其他幸存者的关系有所改善');}return msgs.join('；');
  }
  function loseRandomItem(c){if(!c.inventory.length)return null;if(has(c,'drybag'))return null;const id=rand(c.inventory);c.inventory.splice(c.inventory.indexOf(id),1);return id;}
  function beastHazard(c){if(campProtection(c,'beast'))return '营地警戒与遮蔽让野兽没有靠近';if(has(c,'torch')){if(chance(.3))breakItem(c,'torch');return '火把吓退了野兽';}const ok=checkChance(c,'agi','normal',[]);if(ok)return '成功躲开';applyDamage(c,1,'野兽袭击');return '遭到袭击，生命-1';}
  function rainHazard(c){if(campProtection(c,'rain'))return '营地遮雨棚挡住了暴雨';if(has(c,'tarp'))return '雨布挡住了暴雨';if(has(c,'raincoat')&&!c.raincoatUsed){c.raincoatUsed=true;breakItem(c,'raincoat');return '破旧雨衣挡住了这一次暴雨';}healthDamage(c,1);return '健康-1';}

  function chooseLocationEvent(locationId,forNpc=false){
    if(!forNpc){const se=storyEventForLocation(locationId);if(se){sound('story');return se;}}
    const recent=forNpc?state.recentNpcEvents:state.recentPlayerEvents;
    let pool=D.locationEvents.filter(e=>e.location===locationId&&(!e.minDay||state.day>=e.minDay)&&!recent.includes(e.id));
    if(!pool.length)pool=D.locationEvents.filter(e=>e.location===locationId&&(!e.minDay||state.day>=e.minDay));
    if(!pool.length)pool=D.locationEvents.filter(e=>!e.minDay||state.day>=e.minDay);
    const e=rand(pool);recent.push(e.id);if(recent.length>10)recent.shift();return e;
  }
  function exploreLocation(locationId){
    if(state.phase!=='PREPARE'||state.currentEvent)return;const loc=locationById(locationId);if(!loc)return;const p=player();p.locationId=locationId;state.selectedLocationId=locationId;state.exploredLocations[locationId]=true;state.currentEvent=chooseLocationEvent(locationId,false);state.phase='EVENT';log(`你前往${loc.name}探索，并将在这里过夜。`);sound('card');save();render();
  }
  function gatherCampMaterial(locationId){
    if(!chance(.38))return '';
    const map={
      coconut_grove:{fiber:1},jungle_path:{wood:1},bamboo_clearing:{wood:1},rock_cave:{scrap:1},
      crash_beach:{scrap:1},wreck_cabin:{scrap:1},swamp_edge:{fiber:1},fresh_stream:{wood:1},cliff_edge:{wood:1}
    };
    const mat=map[locationId];if(!mat)return '';
    addCampMaterial(mat);const labels={wood:'木材',fiber:'藤条',scrap:'零件'};const txt=Object.entries(mat).map(([k,v])=>`${labels[k]}+${v}`).join('、');
    return `探索途中还收集到营地材料：${txt}`;
  }

  function resolveInstantOrCheck(index=null){
    const c=player(),e=state.currentEvent;if(!e||state.eventResolved)return;let result='';if(e.type==='instant')result=applyEffect(c,e.effect,e.name);else if(e.type==='hazard')result=e.hazard==='beast'?beastHazard(c):rainHazard(c);else if(e.type==='check'){const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]);result=ok?`检定成功。${applyEffect(c,e.success,e.name)}`:`检定失败。${applyEffect(c,e.fail,e.name)}`;}else if(e.type==='choice'){const ch=e.choices[index];result=resolveChoice(c,e,ch,false);advanceStory(e,ch);}const materialMsg=gatherCampMaterial(state.selectedLocationId);if(materialMsg)result+=(result?'；':'')+materialMsg;state.eventResolved=true;state.phase='POST';state.currentResult=result||'无事发生';if(c.dead){endGame(false);return;}save();render();
  }
  function resolveChoice(c,e,ch,isNpc){
    if(!ch)return '无事发生';if(ch.risk==='危险'&&c.id===state.playerId)state.statistics.risksTaken++;if(ch.action==='none')return '你选择不冒险。';if(ch.action==='effect')return applyEffect(c,ch.effect||{},e.name)||'无事发生';if(ch.action==='check'){const ok=checkChance(c,ch.stat,ch.difficulty,ch.tags||e.tags||[]);if(ok)return `检定成功。${applyEffect(c,ch.success,e.name)}`;const f=ch.fail||{};if(f.chance&&!chance(f.chance))return '检定失败，但没有造成进一步损失。';if(f.beast)return `检定失败。${beastHazard(c)}`;return `检定失败。${applyEffect(c,f,e.name)}`;}if(ch.action==='randomFood'){const r=rng();if(r<.6){addHealth(c,1);return '味道古怪，但健康+1';}if(r<.85)return '你等了一会儿，似乎没事。';healthDamage(c,1);return '胃开始翻腾，健康-1';}if(ch.action==='gambleFood'){const r=rng();if(r<.55){addHealth(c,1);return '勉强能吃，健康+1';}if(r<.8)return '没有明显效果。';applyDamage(c,1,'食物中毒');return '情况比想象糟，生命-1';}if(ch.action==='mushroom'){const r=rng();if(r<.5){addHealth(c,2);return '居然能吃，健康+2';}if(r<.8)return '没有明显效果。';applyDamage(c,1,'误食有毒蘑菇');return '你很快意识到判断错了，生命-1';}return '无事发生';
  }

  function enemy(a,b){return relationScore(a,b)<=-50;}
  function makeEnemy(a,b){state.relationships[pairKey(a.id,b.id)]=-80;}
  function combatPower(c){let weaponBonus=0;if(has(c,'dagger')||has(c,'spear'))weaponBonus=1;return c.str+c.agi+weaponBonus;}
  function fight(a,b){makeEnemy(a,b);changeRelation(a,b,-25,'发生战斗');a.stats.battles++;b.stats.battles++;if(a.id===state.playerId||b.id===state.playerId)state.statistics.battles++;const diff=combatPower(a)-combatPower(b);const p=diff>=3?1:diff===2?.9:diff===1?.7:diff===0?.5:diff===-1?.3:diff===-2?.1:0;const winA=chance(p),w=winA?a:b,l=winA?b:a;w.stats.wins++;if(w.id===state.playerId)state.statistics.battleWins++;let loot='';if(l.inventory.length){const id=rand(l.inventory);l.inventory.splice(l.inventory.indexOf(id),1);gainItem(w,id,'战利品');loot=`，夺得${item(id).name}`;}applyDamage(l,1,'与幸存者战斗');return `${w.name}获胜${loot}；${l.name}生命-1。`;}
  function trade(a,b,playerGiveId=null){
    a.stats.trades++;b.stats.trades++;changeRelation(a,b,10,'完成交易');if(a.id===state.playerId||b.id===state.playerId)state.statistics.trades++;if(!a.inventory.length&&!b.inventory.length)return '双方都没有道具，交易作罢。';const freeKey=pairKey(a.id,b.id),lastFree=state.freeTrades?.[freeKey]||-99;
    if(!a.inventory.length){if(state.day-lastFree<10)return '这两个人最近已经发生过一次免费赠予，本次交易取消。';const give=[...b.inventory].sort((x,y)=>NPC.itemValue(item(x),b,state.day)-NPC.itemValue(item(y),b,state.day))[0];b.inventory.splice(b.inventory.indexOf(give),1);gainItem(a,give,'免费获得');state.freeTrades[freeKey]=state.day;return `${a.name}没有道具，${b.name}给了TA一件${item(give).name}。`;}
    if(!b.inventory.length){if(state.day-lastFree<10)return '这两个人最近已经发生过一次免费赠予，本次交易取消。';const give=playerGiveId&&a.id===state.playerId?playerGiveId:[...a.inventory].sort((x,y)=>NPC.itemValue(item(x),a,state.day)-NPC.itemValue(item(y),a,state.day))[0];a.inventory.splice(a.inventory.indexOf(give),1);gainItem(b,give);state.freeTrades[freeKey]=state.day;return `${b.name}没有道具，免费获得了${item(give).name}。`;}
    const aiA=a.id===state.playerId?playerGiveId:[...a.inventory].sort((x,y)=>NPC.itemValue(item(x),a,state.day)-NPC.itemValue(item(y),a,state.day))[0];const aiB=b.id===state.playerId?playerGiveId:[...b.inventory].sort((x,y)=>NPC.itemValue(item(x),b,state.day)-NPC.itemValue(item(y),b,state.day))[0];if(!aiA||!aiB)return '交易取消。';a.inventory.splice(a.inventory.indexOf(aiA),1);b.inventory.splice(b.inventory.indexOf(aiB),1);a.inventory.push(aiB);b.inventory.push(aiA);return `${a.name}用${item(aiA).name}换得${item(aiB).name}。`;
  }
  function resolveNpcEncounter(a,b){const rel=relationScore(a,b);const act=rel>=35?'trade':rel<=-45?'fight':NPC.encounterAction(a,b,D,rng,enemy(a,b));let r;if(act==='fight')r=fight(a,b);else if(act==='trade')r=trade(a,b);else{const baseAvoid=Number(rules().avoidChance)||.20;const avoid=chance(clamp(baseAvoid+(a.id==='suqing'?.15:0),.05,.95));r=avoid?'双方彼此避开，没有发生冲突。':(enemy(a,b)||chance(.5)?`躲避失败。${fight(a,b)}`:`躲避失败。${trade(a,b)}`);}log(`${a.name}与${b.name}在${locationById(a.locationId)?.name||'岛上'}相遇：${r}`);}
  function processNpcMorningGroups(excludedLocationId){
    const groups={};for(const c of alive().filter(c=>c.id!==state.playerId&&c.locationId!==excludedLocationId)){(groups[c.locationId]||(groups[c.locationId]=[])).push(c);}
    for(const list of Object.values(groups)){shuffle(list);for(let i=0;i+1<list.length;i+=2){if(!list[i].dead&&!list[i+1].dead)resolveNpcEncounter(list[i],list[i+1]);}}
  }
  function prepareMorningEncounter(){
    const p=player();const candidates=alive().filter(c=>c.id!==p.id&&c.locationId===p.locationId).map(c=>c.id);if(!candidates.length){state.morningEncounter=null;state.phase='PREPARE';return;}
    state.morningEncounter={candidates,targetId:candidates.length===1?candidates[0]:null,forced:false,resolved:false,result:''};state.phase='MORNING_ENCOUNTER';sound('encounter');
  }
  function selectMorningTarget(id){if(!state.morningEncounter||!state.morningEncounter.candidates.includes(id))return;state.morningEncounter.targetId=id;save();render();}
  function morningAction(action,giveId=null){
    const m=state.morningEncounter,p=player();if(!m||m.resolved)return;
    if(action==='avoid'){
      p.stats.avoids++;const base=Number(rules().avoidChance)||.20;const success=chance(clamp(base+(p.id==='suqing'?.15:0),.05,.95));
      if(success){m.resolved=true;m.result='你在他们发现你之前悄悄离开了。';sound('good');}
      else{m.targetId=rand(m.candidates);m.forced=true;m.result=`躲避失败，${cBy(m.targetId).name}拦住了你。你必须选择交易或战斗。`;sound('bad');}
      save();render();return;
    }
    const o=cBy(m.targetId);if(!o){toast('请先选择一位幸存者');return;}
    let result='';if(action==='fight')result=fight(p,o);else if(action==='trade')result=trade(p,o,giveId);m.result=result;m.resolved=true;m.interactedId=o.id;log(`清晨相遇：${result}`);if(p.dead){endGame(false);return;}save();render();
  }
  function finishMorningEncounter(){
    const loc=player().locationId;const interacted=state.morningEncounter?.interactedId;const others=alive().filter(c=>c.id!==state.playerId&&c.id!==interacted&&c.locationId===loc);shuffle(others);for(let i=0;i+1<others.length;i+=2){if(!others[i].dead&&!others[i+1].dead)resolveNpcEncounter(others[i],others[i+1]);}
    state.morningEncounter=null;state.phase='PREPARE';save();render();
  }

  function morningRelationshipSupport(){
    const p=player();
    const friends=alive().filter(c=>c.id!==p.id&&c.locationId===p.locationId&&relationScore(p,c)>=35).sort((a,b)=>relationScore(p,b)-relationScore(p,a));
    if(!friends.length)return;
    const f=friends[0];
    if(p.health<=1&&chance(.35)){
      const food=f.inventory.find(id=>item(id).kind==='food');
      if(food){f.inventory.splice(f.inventory.indexOf(food),1);addHealth(p,1);changeRelation(p,f,4,'互相照顾');log(`${f.name}清晨主动分给你一些食物。`);toast(`${f.name}主动照顾了你`);}
    }else if(p.life<=1&&chance(.18)){p.nextCheckBonus=Math.max(p.nextCheckBonus,.08);log(`${f.name}陪你休息了一会儿，你的下一次检定更稳。`);}
  }

  function startDay(showFx=true){
    const p=player();if(p.id==='linlan'&&p.life===1&&p.lowLifeSeen&&p.abilityCooldown<=0&&chance(.3)){addLife(p,1);p.abilityCooldown=5;log('林岚的急救本能触发，生命+1');}
    state.characters.forEach(c=>{if(c.abilityCooldown>0)c.abilityCooldown--;if(!c.dead)c.dayStartHealth=c.health;});state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.nightDanger=0;state.selectedLocationId=null;
    campProduction();updateCrisisNotice();morningRelationshipSupport();processNpcMorningGroups(p.locationId);prepareMorningEncounter();save();render();if(showFx)setTimeout(showDayTransition,40);
  }

  function npcUseNeeds(c){if(c.dead)return;const firstAid=c.inventory.indexOf('first_aid');if(c.life<=Math.max(1,c.maxLife-2)&&firstAid>=0)useNpcItem(c,'first_aid');if(NPC.shouldUseFood(c)){const food=c.inventory.find(id=>item(id).kind==='food');if(food)useNpcItem(c,food);}}
  function useNpcItem(c,id){const it=item(id),idx=c.inventory.indexOf(id);if(idx<0||!it.consumable)return;if(it.effect?.health)addHealth(c,it.effect.health);if(it.effect?.life)addLife(c,it.effect.life);if(it.effect?.skipDecay)c.skipDecay=true;if(it.effect?.shield)c.damageShield++;if(it.effect?.generalShield)c.generalShield++;if(it.effect?.wildFood){if(chance(.75))addHealth(c,1);else healthDamage(c,1);}let consume=true;if(c.id==='gaoyuan'&&it.kind==='food'&&chance(.25))consume=false;if(consume)c.inventory.splice(idx,1);}
  function chooseNpcDestination(c){if(chance(.22))return c.locationId;const options=D.locations.filter(l=>l.id!==c.locationId);return rand(options).id;}
  function npcTurn(c){if(c.dead)return;npcUseNeeds(c);c.locationId=chooseNpcDestination(c);const e=chooseLocationEvent(c.locationId,true);if(e.type==='instant')applyEffect(c,e.effect,e.name);else if(e.type==='hazard'){if(e.hazard==='beast')beastHazard(c);else rainHazard(c);}else if(e.type==='check'){const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]);applyEffect(c,ok?e.success:e.fail,e.name);}else if(e.type==='choice'){const ix=NPC.eventChoice(c,e,D,rng);resolveChoice(c,e,e.choices[ix],true);}npcUseNeeds(c);}

  function runNight(){
    let trigger=(Number(rules().nightEventChance)||.70)+state.nightDanger;if(has(player(),'flashlight'))trigger-=.15;trigger=clamp(trigger,.15,.90);if(!chance(trigger))return {title:'今夜平静',text:'风从树林里穿过去。没有发生特别的事。',locationId:null};
    const eligible=D.nights.filter(n=>!n.minDay||state.day>=n.minDay);const n=rand(eligible);const ef=n.effect,living=alive();const occupied=[...new Set(living.map(c=>c.locationId))];const targetLocationId=n.scope==='location'&&occupied.length?rand(occupied):null;const affected=targetLocationId?living.filter(c=>c.locationId===targetLocationId):living;let extra=[];
    if(ef.allHazard==='rain')affected.forEach(c=>extra.push(`${c.name}：${rainHazard(c)}`));if(ef.randomHazard==='beast'&&affected.length){const c=rand(affected);extra.push(`${c.name}：${beastHazard(c)}`);}if(ef.weakHealth)affected.filter(c=>c.health<=1).forEach(c=>{healthDamage(c,1);extra.push(`${c.name}健康-1`);});if(ef.randomLoseItem&&affected.length){const c=rand(affected),id=loseRandomItem(c);if(id)extra.push(`${c.name}失去${item(id).name}`);}if(ef.randomHealthDamage)affected.forEach(c=>{if(chance(ef.randomHealthDamage)){healthDamage(c,1);extra.push(`${c.name}健康-1`);}});if(ef.randomHealth&&affected.length){const c=rand(affected);if(ef.randomHealth>0)addHealth(c,ef.randomHealth);else healthDamage(c,-ef.randomHealth);extra.push(`${c.name}健康${ef.randomHealth>0?'+':''}${ef.randomHealth}`);}if(ef.lowestHealth&&affected.length){const min=Math.min(...affected.map(c=>c.health));const c=rand(affected.filter(x=>x.health===min));addHealth(c,ef.lowestHealth);extra.push(`${c.name}健康+1`);}if(ef.allChanceHealth)affected.forEach(c=>{if(chance(ef.allChanceHealth)){healthDamage(c,1);extra.push(`${c.name}健康-1`);}});if(ef.randomItem&&affected.length){const c=rand(affected),id=randomItem();gainItem(c,id);extra.push(`${c.name}获得${item(id).name}`);}if(ef.nextCheckBonus)affected.forEach(c=>c.nextCheckBonus=Math.max(c.nextCheckBonus,ef.nextCheckBonus));if(ef.protectWeak)affected.filter(c=>c.health<=1).forEach(c=>c.skipDecay=true);if(ef.rescueScore)state.rescueScore+=ef.rescueScore;if(ef.relationDown&&affected.length>=2){const [a,b]=shuffle([...affected]).slice(0,2);changeRelation(a,b,-10,'夜间争吵');extra.push(`${a.name}和${b.name}之间的气氛变差了`);}if(ef.theft&&affected.length>=2&&chance(.28)){const [a,b]=shuffle([...affected]).slice(0,2);if(b.inventory.length&&a.inventory.length<invLimit(a)){const id=rand(b.inventory);b.inventory.splice(b.inventory.indexOf(id),1);a.inventory.push(id);changeRelation(a,b,-20,'夜间失窃');extra.push(`${a.name}拿走了${b.name}的${item(id).name}`);}}
    const locName=targetLocationId?locationById(targetLocationId)?.name:null;return {title:locName?`${locName} · ${n.name}`:n.name,text:n.text+(extra.length?'\n'+extra.join('；'):''),locationId:targetLocationId};
  }
  function settleDay(){for(const c of alive()){const beganZero=c.dayStartHealth===0;if(beganZero&&c.health===0)applyDamage(c,1,'长期缺乏食物');else if(c.health>0&&!c.skipDecay){let decay=Number(rules().healthDecayChance)??1;if(c.locationId===camp().locationId&&camp().buildings.water_collector)decay=Math.max(.35,decay-.10);if(chance(decay))healthDamage(c,1);}c.skipDecay=false;if(c.dead)continue;if(c.health>=2)c.healthyStreak++;else c.healthyStreak=0;if(c.healthyStreak>=3){if(chance(Number(rules().healthyLifeRecoverChance)??.20))addLife(c,1);c.healthyStreak=0;}}state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.selectedLocationId=null;}
  function endDay(){const p=player();if(p.dead)return;state.characters.filter(c=>!c.dead&&c.id!==state.playerId).forEach(npcTurn);const report=runCrisis()||runNight();settleDay();if(p.dead){endGame(false);return;}if(state.day>=80){state.day=81;endGame(true);return;}state.lastNight=report;state.phase='NIGHT_REPORT';sound('night');save();render();}
  function nextDay(){state.day++;state.lastNight=null;startDay(true);}

  function unlock(id){let list=[];try{list=JSON.parse(localStorage.getItem(ACH)||'[]');}catch(e){}if(!list.includes(id)){list.push(id);localStorage.setItem(ACH,JSON.stringify(list));}}
  function endGame(win){const p=player();state.phase=win?'VICTORY':'GAME_OVER';if(win){unlock('day81');if(alive().length===6)unlock('all_alive');if(state.statistics.battles===0)unlock('pacifist');if(state.statistics.battles>=5)unlock('island_boss');}const survived=win?81:Math.max(1,state.day);let score=Math.round((survived/81)*50)+(win?20:0);score+=Math.round(10*((p.life/p.maxLife)*.7+(p.health/3)*.3));score+=Math.min(8,Math.round((p.inventory.reduce((s,id)=>s+(item(id).value||0),0)/32)*8));score+=Math.max(0,Math.min(7,Math.round(state.statistics.trades*1.5-state.statistics.battles*.6+3)));score+=Math.min(5,Math.round(state.rescueScore));state.score=clamp(Math.round(score),0,100);state.leaderboard=state.leaderboard||{submitted:false};save();render();}
  function rating(score){if(score>=95)return['荒岛传奇','贝爷看了你的生存记录，决定先回去补补课。'];if(score>=85)return['生存大师','你不是在荒岛求生，你像是在这里短期驻场。'];if(score>=70)return['靠谱幸存者','虽然狼狈，但救援船最终看到的是一个还能自己走上船的人。'];if(score>=55)return['命够硬','有些时候你靠策略，有些时候你纯粹靠命。'];if(score>=40)return['岛上老油条','能活这么久，已经不能完全用运气解释。'];if(score>=20)return['生存体验卡','你大概已经知道，下次什么东西不能乱吃了。'];return['三日游游客','无人岛甚至还没来得及记住你的名字。'];}

  function riskHint(ch){const p=player();if(p.id==='suqing')return ch.risk?`风险：${ch.risk}`:'';if(has(p,'binoculars')&&ch.risk==='危险')return '这里似乎有危险……';return ch.stat?`${{str:'力量',agi:'敏捷',int:'知识',luck:'幸运'}[ch.stat]||''}检定`:'';}
  function hearts(c){return '❤️'.repeat(Math.max(0,c.life))+'♡'.repeat(Math.max(0,c.maxLife-c.life));}
  function healthDots(c){return '●'.repeat(c.health)+'○'.repeat(3-c.health);}
  function invHtml(c,interactive=true){let h='';for(let i=0;i<invLimit(c);i++){const id=c.inventory[i];if(!id){h+=`<div class="slot empty"><div class="ico">＋</div><div class="label">空位</div></div>`;continue;}const it=item(id);h+=`<button class="slot" ${interactive?`onclick="Game.itemInfo('${id}')"`:''}><div class="ico">${it.ico}</div><div class="label">${esc(it.name)}</div></button>`;}return h;}
  function statusHtml(c){
    const loc=locationById(c.locationId);
    return `<section class="card heroStatus"><div class="person heroPerson"><div class="portraitWrap">${portrait(c,'portraitMain')}<span class="roleIcon">${c.avatar}</span></div><div class="heroMeta"><div class="name">${esc(c.name)} · ${esc(c.job)}</div><div class="meta">${c.sex} · ${c.age}岁 · 📍${esc(loc?.name||'未知')}</div><div class="statusLine">生命 <span class="hearts">${hearts(c)}</span></div><div class="statusLine">健康 <span class="healthdots">${healthDots(c)}</span></div></div><button class="btn small secondary" onclick="Game.survivors()">关系</button></div><div class="stats"><div class="stat">力量<b>${c.str}</b></div><div class="stat">敏捷<b>${c.agi}</b></div><div class="stat">知识<b>${c.int}</b></div><div class="stat">幸运<b>${c.luck}</b></div></div></section>`;
  }
  function topHtml(){
    const [st]=stageInfo();
    return `<div class="topbar"><div class="dayrow"><div class="day">DAY ${state.day} <span class="muted" style="font-size:13px">/ 81</span></div><div class="topTools"><span class="stage">${st} · ${state.difficultyLabel}</span><button class="soundBtn" onclick="Game.showCamp()" aria-label="营地">🏕️</button><button class="soundBtn" onclick="Game.toggleSound()" aria-label="声音">${soundEnabled?'🔊':'🔇'}</button></div></div><div class="progress"><i style="width:${Math.min(100,state.day/81*100)}%"></i></div></div>`;
  }
  function activeStoryTarget(){
    for(const chain of (D.storyChains||[])){const st=getStoryState(chain.id);if(st?.started&&!st.completed){const step=chain.steps[st.step];if(step)return {chain,step,ready:state.day>=st.nextDay,wait:Math.max(0,st.nextDay-state.day)};}}
    return null;
  }
  function mapHtml(){
    const exploredCount=Object.keys(state.exploredLocations||{}).length,p=player(),story=activeStoryTarget();
    return `<section class="card islandCard"><div class="row between"><div><div class="section-title">海岛地图</div><div class="name" style="font-size:18px">选择今天的探索地点</div></div><div class="meta">已探索 ${exploredCount}/12</div></div><div class="islandMap"><div class="islandSea"></div><div class="islandBody"></div>${D.locations.map(loc=>{const known=state.exploredLocations?.[loc.id],current=p.locationId===loc.id,label=known?loc.name:'未知',storyHere=story?.ready&&story.step.location===loc.id,campHere=loc.id===camp().locationId&&Object.keys(camp().buildings||{}).length;return `<button class="mapSpot ${known?'known':''} ${current?'current':''} ${storyHere?'storySpot':''}" style="left:${loc.x}%;top:${loc.y}%" onclick="Game.explore('${loc.id}')"><span class="pin">${current?'🧍':storyHere?'📖':campHere?'🏕️':known?loc.icon:'❓'}</span><span class="spotLabel">${esc(label)}${current?' · 当前':''}${storyHere?' · 剧情':''}</span></button>`;}).join('')}</div><div class="mapLegend">你昨天在 <b>${esc(locationById(p.locationId)?.name||'未知地点')}</b> 过夜。选择地点后，今天探索结束也会留在那里。</div></section>`;
  }
  function crisisHtml(){
    const n=state.crisisNotice;if(!n)return '';
    return `<section class="crisisBanner ${n.left===0?'now':''}"><div class="crisisIcon">${n.icon}</div><div><b>${esc(n.name)}${n.left===0?' 今晚来临':' 即将来临'}</b><span>${n.left===0?'危机将在今晚发生':`预计 ${n.left} 天后发生`} · ${esc(n.desc)}</span></div></section>`;
  }
  function storyHintHtml(){
    const s=activeStoryTarget();if(!s)return '';
    const loc=locationById(s.step.location);
    return `<section class="storyHint"><span>📖</span><div><b>连续剧情 · ${esc(s.chain.name)}</b><small>${s.ready?`新线索指向：${esc(loc?.name||'未知地点')}`:`线索还需要等待 ${s.wait} 天`}</small></div></section>`;
  }
  function campSummaryHtml(){
    const c=camp(),built=Object.keys(c.buildings||{}).length;
    return `<section class="campMini" onclick="Game.showCamp()"><span>🏕️ 营地 ${built}/4</span><span>🪵${c.materials.wood||0} · 🌿${c.materials.fiber||0} · ⚙️${c.materials.scrap||0}</span></section>`;
  }


  function renderHome(){
    const s=load();
    const cast=D.characters.map(c=>`<img src="${esc(c.portrait)}" alt="${esc(c.name)}">`).join('');
    app.innerHTML=`<div class="screen center homeScreen"><div class="homeHero"><img src="assets/home-island.jpg" alt="八十一天海岛"></div><div class="subbrand homeSub">DAY 81 · 荒岛生存卡牌冒险</div><div class="castStrip">${cast}</div><div class="tagline">飞机迫降荒岛。六个人活了下来。<br>探索、关系、营地与危机，会让每一局都产生不同的故事。<br><b>救援将在第八十一天到来——前提是，你还活着。</b></div><button class="btn" onclick="Game.selectScreen()">开始游戏</button>${s?'<button class="btn secondary" style="margin-top:10px" onclick="Game.continueGame()">继续游戏</button>':''}<button class="btn ghost" style="margin-top:10px" onclick="Game.showLeaderboard()">🏆 排行榜</button><div class="muted" style="margin-top:16px;font-size:12px">建议开启声音 · 手机首次点击后会自动解锁音效</div></div>`;
  }
  function renderSelect(){
    app.innerHTML=`<div class="screen"><div class="brand" style="font-size:28px;text-align:center">选择幸存者</div><div class="grid2">${D.characters.map(c=>`<div class="card character animeCard"><div class="charPortraitBox">${portrait(c,'charPortrait')}</div><div class="name">${esc(c.name)}</div><div class="meta">${c.sex} · ${c.age}岁 · ${esc(c.job)}</div><div class="hearts" style="margin:8px 0">${'❤️'.repeat(c.maxLife)}</div><div class="meta">力量${c.str} · 敏捷${c.agi} · 知识${c.int} · 幸运${c.luck}</div><div class="ability">${esc(c.ability)}</div><div class="ability">初始：<span class="itemName">${item(c.startItem).ico}${esc(item(c.startItem).name)}</span></div><button class="btn small" style="margin-top:10px;width:100%" onclick="Game.chooseDifficulty('${c.id}')">选择TA</button></div>`).join('')}</div><button class="btn ghost" onclick="Game.home()">返回</button></div>`;
  }
  function renderDifficulty(playerId){
    const c=D.characters.find(x=>x.id===playerId);
    app.innerHTML=`<div class="screen"><div class="brand" style="font-size:28px;text-align:center">选择难度</div><section class="card difficultyHero">${portrait(c,'portraitDifficulty')}<div><div class="name">${esc(c.name)} · ${esc(c.job)}</div><div class="meta">选择难度后将随机分配六人的初始地点。</div></div></section><div class="difficultyGrid">${Object.entries(DIFFICULTY_META).map(([key,m])=>`<button class="difficultyCard ${key}" onclick="Game.start('${playerId}','${key}')"><b>${m.label}</b><span>${m.desc}</span><em>${key==='normal'?'推荐':''}</em></button>`).join('')}</div><button class="btn ghost" onclick="Game.selectScreen()">返回角色选择</button></div>`;
  }
  function renderMain(){
    const p=player();if(state.phase==='MORNING_ENCOUNTER')return renderMorningEncounter();if(state.phase==='NIGHT_REPORT')return renderNight();if(state.phase==='VICTORY'||state.phase==='GAME_OVER')return renderEnd();let center='',typeAfter=null;
    if(state.phase==='EVENT'&&state.currentEvent){const e=state.currentEvent,loc=locationById(state.selectedLocationId);const key=`${state.day}-${e.id}`,shouldType=lastTypedKey!==key;const controls=e.choices.map((ch,i)=>`<button class="choice" onclick="Game.resolve(${i})">${esc(ch.text)}<small>${esc(riskHint(ch))}</small></button>`).join('');center=`<section class="paper eventPaper ${e.storyChain?'storyPaper':''}"><div class="eventLocIcon">${loc?.icon||'🗺️'}</div><div class="section-title">${e.storyChain?'📖 连续剧情 · '+esc(e.storyName):'今日探索'} · ${esc(loc?.name||'未知地点')}</div><div class="event-title">${esc(e.name)}</div><div class="event-text" id="eventText">${shouldType?'':richText(e.text)}</div><div class="choices ${shouldType?'typingLocked':''}" id="eventChoices">${controls}</div></section>`;if(shouldType){lastTypedKey=key;typeAfter=()=>typeText(document.getElementById('eventText'),e.text);}}
    else if(state.phase==='POST'){const loc=locationById(state.selectedLocationId);center=`<section class="paper eventPaper ${state.currentEvent?.storyChain?'storyPaper':''}"><div class="eventLocIcon">${loc?.icon||'🗺️'}</div><div class="section-title">${state.currentEvent?.storyChain?'📖 剧情结果':'探索结果'} · ${esc(loc?.name||'未知地点')}</div><div class="event-title">${esc(state.currentEvent?.name||'今日探索')}</div><div class="event-text">${richText(state.currentEvent?.text||'')}</div><div class="result richResult">${richText(state.currentResult)}</div></section><button class="btn" onclick="Game.endDay()">结束今天</button>`;}
    else center=`${mapHtml()}<section class="paper"><div class="section-title">今天去哪里？</div><div class="event-title">探索决定今晚的位置</div><div class="event-text">点击地图上的任意地点。到达后会触发一个地点专属随机事件，并提供三个行动选项。</div></section>`;
    app.innerHTML=`<div class="screen">${topHtml()}${statusHtml(p)}${crisisHtml()}${storyHintHtml()}${campSummaryHtml()}${center}<section><div class="section-title">背包 · ${p.inventory.length}/${invLimit(p)}</div><div class="inventory" style="grid-template-columns:repeat(${Math.min(invLimit(p),4)},1fr)">${invHtml(p,true)}</div></section><div class="row"><button class="btn small ghost" onclick="Game.logs()">生存日志</button><button class="btn small ghost" onclick="Game.restartAsk()">重新开始</button></div></div>`;if(state.pending)renderPending();if(typeAfter)setTimeout(typeAfter,80);
  }
  function renderMorningEncounter(){
    const p=player(),m=state.morningEncounter,loc=locationById(p.locationId);if(!m){state.phase='PREPARE';render();return;}if(m.resolved){app.innerHTML=`<div class="screen">${topHtml()}${statusHtml(p)}<section class="paper encounterPaper"><div class="section-title">清晨 · ${esc(loc?.name||'未知地点')}</div><div class="event-title">相遇结束</div><div class="result richResult">${richText(m.result)}</div></section><button class="btn" onclick="Game.finishMorning()">打开海岛地图</button></div>`;return;}
    const people=m.candidates.map(id=>cBy(id)).filter(Boolean);const target=m.targetId?cBy(m.targetId):null;const peopleHtml=people.map(c=>`<button class="meetPerson ${m.targetId===c.id?'selected':''}" onclick="Game.selectMorningTarget('${c.id}')">${portrait(c,'meetPortrait')}<span class="meetInfo"><b>${esc(c.name)}</b><small>${esc(c.job)} · 生命${c.life}/${c.maxLife} · 背包${c.inventory.length}</small><em class="relationBadge ${relationClass(p,c)}">${relationLabel(p,c)} · ${relationScore(p,c)>0?'+':''}${relationScore(p,c)}</em></span></button>`).join('');
    if(m.forced&&target){app.innerHTML=`<div class="screen">${topHtml()}${statusHtml(p)}<section class="paper encounterPaper"><div class="section-title">躲避失败 · ${esc(loc?.name||'')}</div><div class="encounterFaces">${portrait(p,'encounterPortrait')}${portrait(target,'encounterPortrait')}</div><div class="event-title">${esc(target.name)} 拦住了你 · <span class="${relationClass(p,target)}">${relationLabel(p,target)}</span></div><div class="event-text">${richText(m.result)}</div></section><div class="choices"><button class="btn danger" onclick="Game.morningAction('fight')">战斗</button><button class="btn secondary" onclick="Game.morningTradeModal()">交易</button></div></div>`;return;}
    app.innerHTML=`<div class="screen">${topHtml()}${statusHtml(p)}<section class="paper encounterPaper"><div class="section-title">清晨相遇 · ${esc(loc?.name||'未知地点')}</div><div class="event-title">这里还有 ${people.length} 位幸存者</div><div class="event-text">昨晚你们都停留在同一个地点。你可以尝试避开所有人，或先选择其中一位进行交易 / 战斗。</div><div class="meetList">${peopleHtml}</div>${target?`<div class="targetHint">已选择：<b>${esc(target.name)}</b></div>`:'<div class="targetHint muted">交易或战斗前，请先选择一位人物。</div>'}</section><div class="choices"><button class="btn secondary" onclick="Game.morningAction('avoid')">躲避</button><button class="btn danger" ${target?'':'disabled'} onclick="Game.morningAction('fight')">战斗</button><button class="btn secondary" ${target?'':'disabled'} onclick="Game.morningTradeModal()">交易</button></div></div>`;
  }
  function renderNight(){const loc=state.lastNight?.locationId?locationById(state.lastNight.locationId):null;const affected=loc&&player().locationId===loc.id;app.innerHTML=`<div class="screen center"><section class="paper nightPaper"><div class="section-title">DAY ${state.day} · 夜晚${loc?` · ${esc(loc.name)}`:''}</div><div class="event-title">${esc(state.lastNight.title)}</div><div class="event-text">${richText(state.lastNight.text)}</div>${loc?`<div class="nightScope ${affected?'affected':''}">${affected?'⚠ 该事件发生在你所在地点':'该事件只影响 '+esc(loc.name)+' 的幸存者'}</div>`:''}</section><button class="btn" onclick="Game.nextDay()">进入 DAY ${state.day+1}</button></div>`;}
  function renderEnd(){const p=player(),win=state.phase==='VICTORY',[title,txt]=rating(state.score),survived=win?81:Math.max(1,state.day),lb=state.leaderboard||{submitted:false};app.innerHTML=`<div class="screen center"><div class="subbrand">${win?'DAY 81 · RESCUE':'SURVIVAL ENDED'}</div><div class="brand" style="font-size:34px">${win?'救援来了':'求生结束'}</div><div class="tagline">${win?'清晨，你被一种陌生的声音惊醒。不是风，也不是海浪。是船。':`DAY ${state.day}，${esc(p.name)}倒下了。<br>原因：${esc(p.deathCause||'生命归零')}`}</div><div class="score">${state.score}</div><div class="name">${title}</div><div class="tagline" style="margin:10px auto 18px">${txt}</div><section class="card" style="text-align:left"><div class="section-title">本局记录</div><div class="row between"><span>幸存天数</span><b>${survived}天</b></div><div class="row between"><span>难度</span><b>${esc(state.difficultyLabel)}</b></div><div class="row between"><span>最终得分</span><b>${state.score}</b></div></section><section class="card leaderboardSubmit"><div class="section-title">🏆 提交排行榜</div>${lb.submitted?`<div class="rankSuccess">账号 <b>${esc(lb.account)}</b> 当前排名：<strong>#${lb.rank||'-'}</strong></div>`:`<div class="meta" style="margin-bottom:10px">输入6—8个字符的账号。相同账号只保留最好成绩。</div><div class="submitRow"><input id="rankAccount" maxlength="8" placeholder="6-8字符账号"><button class="btn small" onclick="Game.submitScore()">提交</button></div><div id="rankMsg" class="rankMsg"></div>`}<button class="btn ghost" style="margin-top:10px" onclick="Game.showLeaderboard()">查看前100名</button></section><section class="card" style="text-align:left"><div class="section-title">最终幸存者</div>${state.characters.map(c=>`<div class="row between ${c.dead?'dead':''}" style="padding:7px 0"><span class="endPerson">${portrait(c,'endPortrait')} ${esc(c.name)}</span><span>${c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:'获救'}</span></div>`).join('')}</section><button class="btn" onclick="Game.selectScreen()">再来一次</button><button class="btn ghost" onclick="Game.home()">返回首页</button></div>`;}
  function renderPending(){const p=player();if(state.pending.type==='pick'){const opts=state.pending.choices.map(id=>`<button class="choice" onclick="Game.pickItem('${id}')">${item(id).ico} <b class="itemName">${esc(item(id).name)}</b><small>${esc(item(id).desc)}</small></button>`).join('');document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>选择一件物资</h2><p class="muted">你只能带走其中一件。</p><div class="choices">${opts}</div></div></div>`);return;}const id=state.pending.incoming,it=item(id);const old=p.inventory.map(x=>`<button class="choice" onclick="Game.replace('${x}')">丢弃 ${item(x).ico} <b class="itemName">${esc(item(x).name)}</b></button>`).join('');document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>背包已满</h2><p>新获得：${it.ico} <b class="itemName">${esc(it.name)}</b></p><p class="muted">必须丢弃一件旧道具，或放弃新道具。</p><div class="choices">${old}<button class="choice" onclick="Game.replace('__new__')">放弃 ${esc(it.name)}</button></div></div></div>`);}

  function modal(html){document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="modal"><div class="modal">${html}</div></div>`);}
  function closeModal(){document.getElementById('modal')?.remove();}
  function itemInfo(id){const it=item(id),can=it.consumable&&(state.phase==='PREPARE'||state.phase==='POST');modal(`<div class="row between"><h2>${it.ico} <span class="itemName">${esc(it.name)}</span></h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><p>${esc(it.desc)}</p><div class="muted">${it.consumable?'消耗品':'携带生效 · 同名效果不叠加'}</div>${can?`<button class="btn" style="margin-top:14px" onclick="Game.use('${id}')">使用</button>`:''}`);}
  function survivors(){
    const ploc=player().locationId,p=player();
    modal(`<div class="row between"><h2>人物关系</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="list">${state.characters.map(c=>`<div class="listItem relationItem ${c.dead?'dead':''}">${portrait(c,'listPortrait')}<div class="relationBody"><div class="row between"><b>${esc(c.name)} · ${esc(c.job)}</b><span>${c.dead?'已死亡':hearts(c)}</span></div><div class="meta">${c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:`健康 ${healthDots(c)} · ${c.id===state.playerId||c.locationId===ploc?'📍'+esc(locationById(c.locationId)?.name||'未知'):'位置未知'}`}</div>${c.id!==p.id&&!c.dead?`<div class="relationMeter"><i style="width:${clamp((relationScore(p,c)+100)/2,0,100)}%"></i></div><div class="relationText ${relationClass(p,c)}">${relationLabel(p,c)} · ${relationScore(p,c)>0?'+':''}${relationScore(p,c)}</div>`:'<div class="relationText">主角</div>'}</div></div>`).join('')}</div>`);
  }
  function logs(){modal(`<div class="row between"><h2>生存日志</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="log">${state.history.length?state.history.slice().reverse().map(x=>`<div class="listItem"><b>DAY ${x.day}</b><br>${richText(x.msg)}</div>`).join(''):'还没有值得记录的事。'}</div>`);}
  function morningTradeModal(){const m=state.morningEncounter,p=player(),o=cBy(m.targetId);if(!o){toast('请先选择一位幸存者');return;}if(!p.inventory.length){morningAction('trade');return;}if(!o.inventory.length){modal(`<h2>交易</h2><p>${esc(o.name)}没有道具。按荒岛规则，你需要免费给TA一件。</p>${p.inventory.map(id=>`<button class="choice" onclick="Game.morningTradeChoose('${id}')">给出 ${item(id).ico}<b class="itemName">${esc(item(id).name)}</b></button>`).join('')}<button class="btn ghost" onclick="Game.closeModal()">取消</button>`);return;}modal(`<h2>选择拿来交换的道具</h2><p class="muted">${esc(o.name)}会根据自己的需要拿出一件物品。</p>${p.inventory.map(id=>`<button class="choice" onclick="Game.morningTradeChoose('${id}')">${item(id).ico} <b class="itemName">${esc(item(id).name)}</b></button>`).join('')}<button class="btn ghost" onclick="Game.closeModal()">取消</button>`);}

  function showCamp(){
    if(!state){toast('开始游戏后才能查看营地');return;}
    closeModal();const c=camp(),here=player().locationId===c.locationId;const labels={wood:'木材',fiber:'藤条',scrap:'零件'};
    const buildings=(D.campBuildings||[]).map(b=>{const built=!!c.buildings[b.id],cost=Object.entries(b.cost||{}).map(([k,v])=>`${labels[k]}×${v}`).join(' · ');return `<div class="campBuild ${built?'built':''}"><div class="campBuildIcon">${b.icon}</div><div class="campBuildText"><b>${esc(b.name)}</b><span>${esc(b.desc)}</span><small>${built?'已建成':cost}</small></div>${built?'<em>✓</em>':`<button class="btn small" ${here&&canBuild(b)?'':'disabled'} onclick="Game.buildCamp('${b.id}')">建造</button>`}</div>`;}).join('');
    modal(`<div class="row between"><h2>🏕️ 公共营地</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="campLocation">📍 林中空地 ${here?'<b>· 你正在这里</b>':'· 前往此地才能建造和领取物资'}</div><div class="campMaterials"><span>🪵 木材 <b>${c.materials.wood||0}</b></span><span>🌿 藤条 <b>${c.materials.fiber||0}</b></span><span>⚙️ 零件 <b>${c.materials.scrap||0}</b></span></div><div class="campStorage"><button class="choice" ${here&&c.storedWater>0?'':'disabled'} onclick="Game.claimCamp('water')">💧 净水储备 ×${c.storedWater||0}<small>领取后健康+1</small></button><button class="choice" ${here&&c.storedFood>0?'':'disabled'} onclick="Game.claimCamp('food')">🐟 食物储备 ×${c.storedFood||0}<small>领取一份烤鱼</small></button></div><div class="section-title" style="margin-top:16px">营地设施</div><div class="campBuildList">${buildings}</div><p class="muted" style="font-size:12px;line-height:1.6">探索时会随机获得木材、藤条和零件。设施建成后会长期影响后续生存与大危机。</p>`);
  }

  async function showLeaderboard(){
    modal(`<div class="row between"><h2>🏆 排行榜</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div id="leaderboardRows" class="leaderboardRows"><div class="muted">正在读取排行榜…</div></div>`);
    try{const r=await fetch('/api/leaderboard',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'读取失败');const box=document.getElementById('leaderboardRows');if(!box)return;box.innerHTML=d.rows.length?`<div class="leaderHead"><span>排名 / 账号</span><span>天数 · 分数</span></div>${d.rows.map(row=>`<div class="leaderRow ${row.rank<=3?'topRank':''}"><span><b>#${row.rank}</b> ${esc(row.account)}<small>${esc(row.character||'')} · ${esc(row.difficulty||'')}</small></span><strong>${row.survivedDays}天 · ${row.score}</strong></div>`).join('')}`:'<div class="muted">还没有人上榜，成为第一名吧。</div>';}
    catch(e){const box=document.getElementById('leaderboardRows');if(box)box.innerHTML=`<div class="bad">${esc(e.message)}</div>`;}
  }
  async function submitScore(){
    if(!state||!(state.phase==='VICTORY'||state.phase==='GAME_OVER'))return;const input=document.getElementById('rankAccount'),msg=document.getElementById('rankMsg'),account=input?.value.trim()||'';if(msg)msg.textContent='';
    try{const payload={account,survivedDays:state.phase==='VICTORY'?81:Math.max(1,state.day),score:state.score,difficulty:state.difficultyLabel,character:player().name};const r=await fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||'提交失败');state.leaderboard={submitted:true,account,rank:d.entry?.rank||null};save();sound('good');render();toast(`成绩已提交${d.entry?.rank?` · 第${d.entry.rank}名`:''}`);}
    catch(e){if(msg){msg.textContent=e.message;msg.className='rankMsg bad';}}
  }

  function render(){document.querySelectorAll('.modalWrap').forEach(x=>x.remove());if(!state){renderHome();return;}renderMain();if(state.pending&&!document.getElementById('pending'))renderPending();}

  window.Game={
    home(){state=null;renderHome();},selectScreen(){app.innerHTML='';renderSelect();},chooseDifficulty(id){renderDifficulty(id);},continueGame(){state=load();if(!state){renderHome();return;}render();},
    start(id,difficultyKey){if(load()&&!confirm('开始新游戏会覆盖旧存档，确定吗？'))return;state=newState(id,difficultyKey||'normal');log(`${player().name}成为主角。初始位置：${locationById(player().locationId).name}。`);startDay(true);},
    explore:exploreLocation,resolve:resolveInstantOrCheck,endDay,nextDay,itemInfo,survivors,logs,closeModal,use(id){closeModal();useItem(player(),id);},toggleSound,showCamp,buildCamp,claimCamp,
    replace(oldId){const p=player(),incoming=state.pending.incoming;if(oldId!=='__new__'){const i=p.inventory.indexOf(oldId);if(i>=0)p.inventory.splice(i,1,incoming);toast(`丢弃${item(oldId).name}，留下${item(incoming).name}`);}else toast(`放弃${item(incoming).name}`);state.pending=null;save();render();},
    pickItem(id){state.pending=null;gainItem(player(),id,'选择获得');save();render();},restartAsk(){if(confirm('确定放弃当前进度并重新开始吗？')){localStorage.removeItem(SAVE);state=null;renderSelect();}},
    selectMorningTarget,morningAction,finishMorning:finishMorningEncounter,morningTradeModal,morningTradeChoose(id){closeModal();morningAction('trade',id);},showLeaderboard,submitScore
  };

  document.addEventListener('pointerdown',unlockAudio,{passive:true});
  document.addEventListener('touchstart',unlockAudio,{passive:true});
  document.addEventListener('click',unlockAudio,{passive:true});

  async function boot(){
    try{const r=await fetch('/api/game-config',{cache:'no-store'});if(r.ok){const cfg=await r.json();GAME_CONFIG={roleNames:{...DEFAULT_GAME_CONFIG.roleNames,...(cfg.roleNames||{})},difficulty:{...DEFAULT_GAME_CONFIG.difficulty,...(cfg.difficulty||{})}};}}catch(e){console.warn('game config unavailable, using defaults',e);}
    applyNamesToCharacters(D.characters);renderHome();
  }
  boot();
})();
