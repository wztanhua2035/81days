(() => {
  'use strict';

  const D = window.DAY81_DATA;
  const NPC = window.DAY81_NPC;
  const SAVE = 'day81_save_v25';
  const ACH = 'day81_achievements_v1';
  const SOUND_KEY = 'day81_sound';
  const FONT_KEY = 'day81_font_size';
  const BGM_KEY = 'day81_bgm';
  const app = document.getElementById('app');

  const DEFAULT_GAME_CONFIG = {
    roleNames: {linlan:'林岚',zhouye:'周野',chenmo:'陈默',suqing:'苏晴',gaoyuan:'高远',xutang:'许棠'},
    difficulty: {nightEventChance:.70,baseCheckModifier:0,healthDecayChance:1,healthyLifeRecoverChance:.20,inventoryLimit:8,startingBonusFood:0,hostileBattleChance:.20,eventRecentWindow:24,interactionRecentWindow:24,bondThreshold:60,npcSaveChanceDay30:.84,npcSaveChanceDay50:.66,npcSaveChanceDay60:.62},
    music:{tracks:[
      {id:'gentle_sea',label:'温柔的海风',src:'/assets/music/gentle_sea.wav'},
      {id:'quiet_forest',label:'静谧森林',src:'/assets/music/quiet_forest.wav'},
      {id:'under_stars',label:'星空之下',src:'/assets/music/under_stars.wav'},
      {id:'morning_light',label:'晨曦之光',src:'/assets/music/morning_light.wav'}
    ]}
  };

  const DIFFICULTY_META = {
    easy:   {label:'容易',desc:'更高事件检定成功率，夜间事件较少，并额外获得食物。'},
    normal: {label:'正常',desc:'推荐难度。夜间特别事件默认70%，资源和风险相对均衡。'},
    hard:   {label:'困难',desc:'检定更苛刻、夜晚更危险，恢复机会更少。'}
  };

  let GAME_CONFIG = JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG));
  let state = null;
  let lastTypedKey = '';
  let audioCtx = null;
  let soundEnabled = localStorage.getItem(SOUND_KEY) !== '0';
  let fontSizePref = localStorage.getItem(FONT_KEY) || 'medium';
  let bgmChoice = localStorage.getItem(BGM_KEY) || 'gentle_sea';
  let bgmAudio = null;
  let BGM_TRACKS = {off:{label:'关闭背景音乐',src:''}};
  function configureBgmTracks(tracks){
    const next={off:{label:'关闭背景音乐',src:''}};
    for(const t of (tracks||[])){
      const id=String(t?.id||'');const label=String(t?.label||'').trim();const src=String(t?.src||'');
      if(!id||!label||!src||id==='off')continue;next[id]={label,src};
    }
    BGM_TRACKS=next;
    if(!BGM_TRACKS[bgmChoice]){bgmChoice=Object.keys(BGM_TRACKS).find(k=>k!=='off')||'off';localStorage.setItem(BGM_KEY,bgmChoice);}
  }
  configureBgmTracks(DEFAULT_GAME_CONFIG.music.tracks);

  function rules(){ return state?.rules || GAME_CONFIG.difficulty; }
  function invLimit(c){ return Number(c?.inventoryLimit || rules().inventoryLimit || 8); }
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
  function inventorySlots(c){
    const slots=[];const counts={};
    for(const id of c?.inventory||[]){
      const it=item(id);if(!it)continue;
      if(it.consumable){counts[id]=(counts[id]||0)+1;}
      else slots.push({id,count:1});
    }
    for(const [id,n] of Object.entries(counts)){for(let left=n;left>0;left-=2)slots.push({id,count:Math.min(2,left)});}
    return slots;
  }
  function invUsedSlots(c){return inventorySlots(c).length;}
  function removeInventoryUnit(c,id){const i=c?.inventory?.indexOf(id)??-1;if(i<0)return false;c.inventory.splice(i,1);return true;}
  function canAddUnit(c,id){const it=item(id);if(!it)return false;if(it.consumable){const n=(c.inventory||[]).filter(x=>x===id).length;if(n%2===1)return true;}return invUsedSlots(c)<invLimit(c);}
  function isStarterItem(c,id){ return !!id && (id===c?.startItem || item(id)?.starter); }
  function tradableItems(c){ return (c?.inventory||[]).filter(id=>!isStarterItem(c,id) && item(id)?.tradable!==false); }
  function lootableItems(c){ return (c?.inventory||[]).filter(id=>!isStarterItem(c,id) && item(id)?.lootable!==false); }
  function discardableItems(c){ return (c?.inventory||[]).filter(id=>!isStarterItem(c,id) && item(id)?.droppable!==false); }
  function gearMod(c,key){ let best=0; for(const id of c?.inventory||[]){ const v=item(id)?.mods?.[key]; if(typeof v==='number') best=Math.max(best,v); else if(v===true) best=Math.max(best,1); } return best; }
  function effectiveStat(c,key){const base=Number(c?.[key]||0),boost=c?.tempBuffDay===state?.day?1:0;return Math.min(5,base+boost);}
  function locationById(id){ return D.locations.find(x=>x.id===id); }
  function stageInfo(day=state.day){ if(day<=20)return['初到荒岛',1]; if(day<=40)return['生存',2]; if(day<=60)return['消耗',3]; return['最后的等待',4]; }
  function save(){ if(!state)return; try{ localStorage.setItem(SAVE,JSON.stringify(state)); }catch(e){ console.warn('save failed',e); } }
  function load(){
    try{
      const x=JSON.parse(localStorage.getItem(SAVE)||'null');
      if(x&&(x.version===23||x.version===25)){
        x.rules={...DEFAULT_GAME_CONFIG.difficulty,...(x.rules||GAME_CONFIG.difficulty)};
        x.exploredLocations=x.exploredLocations||{};
        x.movedToday=!!x.movedToday;x.exploredToday=!!x.exploredToday;x.interactedTargetsToday=x.interactedTargetsToday||[];x.socialActionUsedToday=!!x.socialActionUsedToday;x.socialActionTargetId=x.socialActionTargetId||null;x.interactionScenesToday=x.interactionScenesToday||{};x.travelDecisionMade=!!x.travelDecisionMade;x.locationLockedToday=!!x.locationLockedToday;x.locationBrief=x.locationBrief||'';x.interaction=x.interaction||null;x.recentInteractionEvents=x.recentInteractionEvents||[];x.recentCoupleEvents=x.recentCoupleEvents||[];x.recentLocationEvents=x.recentLocationEvents||{};x.coupleId=x.coupleId||null;
        x.leaderboard=x.leaderboard||{submitted:false};
        x.camp=x.camp||{locationId:'bamboo_clearing',materials:{wood:0,fiber:0,scrap:0},buildings:{},storedFood:0,storedWater:0,lastFoodDay:0,lastWaterDay:0};
        x.shelters=x.shelters||{};x.completedExploreLocations=x.completedExploreLocations||{};x.allExploredRewarded=!!x.allExploredRewarded;x.deathAlerts=x.deathAlerts||[];x.relationAlerts=x.relationAlerts||[];x.nightInteractionLog=x.nightInteractionLog||[];x.camp.damagedBuildings=x.camp.damagedBuildings||{};x.systemAlerts=x.systemAlerts||[];x.shelterBuildReminderShown=!!x.shelterBuildReminderShown;x.dailyActionOrder=x.dailyActionOrder||[];x.npcActedToday=x.npcActedToday||[];x.endSceneSeen=!!x.endSceneSeen;x.lastIntimateEvent=x.lastIntimateEvent||null;x.coupleHome=x.coupleHome||null;x.coupleHomeChoice=x.coupleHomeChoice||null;x.characters.forEach(c=>{c.shelter=c.shelter||{locationId:null,level:0,facilities:[],lastMedicalDay:-99,damaged:false,damagedFacilities:[]};c.shelter.damaged=!!c.shelter.damaged;c.shelter.damagedFacilities=c.shelter.damagedFacilities||[];c.aiExplored=c.aiExplored||{};});
        x.firstMeetings=x.firstMeetings||{};x.dailyAnimals=x.dailyAnimals||{};x.animalInteractedToday=x.animalInteractedToday||[];x.animalInteraction=x.animalInteraction||null;x.recentAnimalEvents=x.recentAnimalEvents||{};x.version=25;
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
  function isImportantLog(msg){
    const s=String(msg||'');
    return /首次遇见|关系.*(普通|冷淡|信任|生死之交|敌对|情侣)|成为[“"]?(情侣|敌对)|死亡|搭起.*窝棚|升级(为|成).*?(小屋|木屋|窝棚)|共同的家|营地建成|危机预警|大危机|连续剧情(完成|推进)|全岛探索奖励|游戏开始|获救/.test(s);
  }
  function log(msg,force=false){ if(!force&&!isImportantLog(msg))return; state.history.push({day:state.day,msg}); if(state.history.length>100) state.history.splice(0,state.history.length-100); }
  function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1800); }


  function portrait(c,cls='portraitSm'){ return `<img class="${cls}" src="${esc(c.portrait||'')}" alt="${esc(c.name)}头像" loading="lazy">`; }
  function relationScore(a,b){
    if(!a||!b||a.id===b.id)return 0;
    const v=state.relationships[pairKey(a.id,b.id)];
    if(typeof v==='number')return v;
    if(v==='enemy')return -100;
    return 0;
  }
  function relationTierByScore(score){
    const bond=Number(rules().bondThreshold||60);
    if(score<=-50)return {key:'enemy',label:'敌对'};
    if(score<=-20)return {key:'cold',label:'冷淡'};
    if(score<25)return {key:'normal',label:'普通'};
    if(score<bond)return {key:'trust',label:'信任'};
    return {key:'bond',label:'生死之交'};
  }
  function queueRelationAlert(other,fromLabel,toLabel,reason='',special=''){
    if(!other||other.dead)return;state.relationAlerts=state.relationAlerts||[];
    const positive=['信任','生死之交','情侣'].includes(toLabel) || (fromLabel==='敌对'&&toLabel!=='敌对');
    state.relationAlerts.push({id:other.id,name:other.name,portrait:other.portrait,from:fromLabel,to:toLabel,reason,special,positive});
  }
  function isCouplePair(a,b){
    const p=player(); if(!p||!state.coupleId||!a||!b)return false;
    return (a.id===p.id&&b.id===state.coupleId)||(b.id===p.id&&a.id===state.coupleId);
  }
  function maybeBecomeCouple(a,b,before,after){
    const threshold=Number(rules().bondThreshold||60);if(state.coupleId||before>=threshold||after<threshold)return false;
    const p=player();if(!p)return false;
    const other=a.id===p.id?b:b.id===p.id?a:null;
    if(!other||other.dead||other.sex===p.sex)return false;
    state.coupleId=other.id;
    log(`${p.name}与${other.name}的关系成为“情侣”。`);
    queueRelationAlert(other,'生死之交','情侣','彼此已经把对方当成最重要的同伴',`${other.name}轻轻看着你：“等我们离开这里以后，还有很多话可以慢慢说。”`);
    setupCoupleHome(other);sound('story');return true;
  }
  function scaledRelationDelta(delta){
    if(!delta)return 0;
    return Math.sign(delta)*Math.max(1,Math.round(Math.abs(delta)*1.25));
  }
  function changeRelation(a,b,delta,reason=''){
    if(!a||!b||a.id===b.id||!delta)return 0;
    delta=scaledRelationDelta(delta);
    const k=pairKey(a.id,b.id),before=relationScore(a,b),beforeTier=relationTierByScore(before),after=clamp(before+delta,-100,100),afterTier=relationTierByScore(after);
    state.relationships[k]=after;
    const involved=a.id===state.playerId||b.id===state.playerId;const other=involved?(a.id===state.playerId?b:a):null;
    const becameCouple=maybeBecomeCouple(a,b,before,after);
    if(involved&&beforeTier.key!==afterTier.key&&!becameCouple){
      let special='';if(afterTier.key==='bond')special=`${other.name}沉默了一会儿，认真地说：“走到今天，我已经不只是把你当普通同伴了。”`;
      queueRelationAlert(other,beforeTier.label,afterTier.label,reason,special);
    }
    if(involved&&beforeTier.key!==afterTier.key&&!becameCouple){
      log(`${other.name}与你的关系：${beforeTier.label} → ${afterTier.label}${reason?`（${reason}）`:''}`,true);
    }
    return after-before;
  }
  function relationLabel(a,b){if(isCouplePair(a,b))return'情侣';const s=relationScore(a,b),bond=Number(rules().bondThreshold||60);if(s<=-50)return'敌对';if(s<=-20)return'冷淡';if(s<25)return'普通';if(s<bond)return'信任';return'生死之交';}
  function relationClass(a,b){if(isCouplePair(a,b))return'relCouple';const s=relationScore(a,b);return s<=-20?'relBad':s>=25?'relGood':'relNormal';}
  function randomOther(c){const list=alive().filter(x=>x.id!==c.id);return list.length?rand(list):null;}
  function animalDef(id){return (D.animals||[]).find(a=>a.id===id)||null;}
  function spawnDailyAnimals(){
    const ids=shuffle(D.locations.map(l=>l.id));state.dailyAnimals={};
    for(const a of (D.animals||[])){const loc=ids.shift();if(loc)state.dailyAnimals[loc]=a.id;}
    state.animalInteractedToday=[];state.animalInteraction=null;
  }
  function animalAtLocation(locationId=player()?.locationId){const id=state?.dailyAnimals?.[locationId];return id?animalDef(id):null;}
  function animalDone(id){return (state.animalInteractedToday||[]).includes(id);}
  function animalScene(animalId){
    const recent=state.recentAnimalEvents||(state.recentAnimalEvents={});const r=recent[animalId]||(recent[animalId]=[]);
    let pool=(D.animalInteractions||[]).filter(e=>e.animal===animalId&&!r.includes(e.id));if(!pool.length){r.length=0;pool=(D.animalInteractions||[]).filter(e=>e.animal===animalId);}
    const e=rand(pool);r.push(e.id);if(r.length>4)r.shift();return e;
  }
  function beginAnimalInteraction(animalId){
    if(!['LOCATION','POST','POST_ACTION'].includes(state.phase))return;const a=animalDef(animalId);if(!a||animalDone(animalId)||animalAtLocation()?.id!==animalId)return;
    state.locationLockedToday=true;state.animalInteraction={animalId,event:animalScene(animalId)};state.phase='ANIMAL_INTERACTION';sound('encounter');save();render();
  }
  function resolveAnimalInteraction(index){
    const ai=state.animalInteraction,a=animalDef(ai?.animalId),e=ai?.event,ch=e?.choices?.[index];if(!a||!ch)return;let result='';
    if(ch.check){const ok=checkChance(player(),ch.check,'normal',[]);if(ok)result=`你处理得很顺利。${applyEffect(player(),ch.good||{},`${a.name}互动`)}`;else if(ch.bad?.beast)result=`你靠得太急，动物的反应比你更快。${beastHazard(player())}`;else result=`你试了试，但事情没有完全按预想发展。${applyEffect(player(),ch.bad||{},`${a.name}互动`)}`;}
    else result=applyEffect(player(),ch.effect||{},`${a.name}互动`)||'你们安静地互相看了一会儿。至少谁也没把事情搞砸。';
    state.animalInteractedToday=state.animalInteractedToday||[];state.animalInteractedToday.push(a.id);state.animalInteraction=null;state.currentResult=`与${a.name}互动：${result}`;state.phase='POST_ACTION';sound('story');save();render();
  }
  function animalInfo(id){const a=animalDef(id);if(!a)return;modal(`<div class="row between"><h2>${a.icon} ${esc(a.name)}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><img src="${esc(a.image)}" class="animalInfoImage" alt="${esc(a.name)}"><p>${esc(a.desc)}</p><div class="meta">性情：${esc(a.temper)} · 今天出现在 ${esc(locationById(player().locationId)?.name||'这里')}</div>`);}

  function camp(){return state.camp;}
  function queueSystemAlert(icon,title,text){state.systemAlerts=state.systemAlerts||[];state.systemAlerts.push({icon,title,text});}
  function checkShelterBuildReady(){
    if(!state||state.shelterBuildReminderShown)return;const p=player(),s=shelterOf(p);if(s.level)return;const def=shelterLevelDef(1);if(!def)return;const cost=effectiveCost(p,def.cost);if(canAffordMaterials(cost)){state.shelterBuildReminderShown=true;queueSystemAlert('🏠','可以搭窝棚了',`你们已经攒够搭建${def.name}的材料。先决定今天停留地点，再打开“我的窝棚”就能开工。`);log('材料已经足够搭建第一座个人窝棚。');}}
  function addCampMaterial(mat){
    if(!mat)return;
    const labels={wood:'木材',fiber:'藤条',scrap:'零件'};
    const gains=[];
    for(const [k,v] of Object.entries(mat)){if(!camp().materials[k])camp().materials[k]=0;camp().materials[k]+=v;gains.push(`${labels[k]||k}+${v}`);}
    if(gains.length)toast(`营地材料：${gains.join('、')}`);checkShelterBuildReady();
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
    log(`营地建成：${b.name}`);sound('build');save();showCamp();
  }
  function campProduction(){
    const c=camp();
    if(c.buildings.water_collector&&!c.damagedBuildings?.water_collector&&state.day-c.lastWaterDay>=3){c.storedWater++;c.lastWaterDay=state.day;log('集水器收集到一份净水。');}
    if(c.buildings.fish_trap&&!c.damagedBuildings?.fish_trap&&state.day-c.lastFoodDay>=4){c.storedFood++;c.lastFoodDay=state.day;log('捕鱼陷阱捕到一份食物。');}
  }
  function claimCamp(kind){
    if(player().locationId!==camp().locationId){toast('需要回到林中空地才能领取');return;}
    if(kind==='water'&&camp().storedWater>0){camp().storedWater--;const ht=gainHealth(player(),1);toast(`饮用营地净水：${ht}`);}
    else if(kind==='food'&&camp().storedFood>0){camp().storedFood--;gainItem(player(),'grilled_fish','营地领取');}
    else toast('暂时没有可领取物资');
    save();showCamp();
  }
  function campProtection(c,type){
    if(shelterProtects(c,type))return true;
    if(c.locationId!==camp().locationId)return false;
    if(type==='rain'&&camp().buildings.shelter&&!camp().damagedBuildings?.shelter)return true;
    if(type==='heat'&&camp().buildings.water_collector&&!camp().damagedBuildings?.water_collector)return true;
    if(type==='beast'&&camp().buildings.shelter&&!camp().damagedBuildings?.shelter)return true;
    return false;
  }



  function shelterOf(c){return c?.shelter||(c.shelter={locationId:null,level:0,facilities:[],lastMedicalDay:-99,damaged:false,damagedFacilities:[]});}
  function emptyShelter(){return {locationId:null,level:0,facilities:[],lastMedicalDay:-99,damaged:false,damagedFacilities:[]};}
  function homeShelterOf(c){
    const p=player();if(state?.coupleHome?.locationId&&p&&state.coupleId&&(c.id===p.id||c.id===state.coupleId))return shelterOf(p);
    return shelterOf(c);
  }
  function finalizeCoupleHome(ownerId){
    const p=player(),partner=cBy(state.coupleId);if(!p||!partner)return;
    const owner=cBy(ownerId)||p,source=shelterOf(owner);if(!source.level)return;
    const chosen=JSON.parse(JSON.stringify(source));p.shelter=chosen;partner.shelter=emptyShelter();state.coupleHome={locationId:chosen.locationId,partnerId:partner.id,ownerId:p.id};state.coupleHomeChoice=null;
    log(`${p.name}和${partner.name}把${locationById(chosen.locationId)?.name||'岛上的一处'}窝棚定为两个人共同的家。`);
    state.systemAlerts=state.systemAlerts||[];state.systemAlerts.push({icon:'🏠',title:'共同的家',text:`你和${partner.name}决定以后共同住在${locationById(chosen.locationId)?.name||'这处窝棚'}。另一处窝棚已废弃。`});
  }
  function setupCoupleHome(other){
    const p=player(),ps=shelterOf(p),os=shelterOf(other);if(!p||!other)return;
    if(ps.level&&os.level){state.coupleHomeChoice={partnerId:other.id};return;}
    if(ps.level){finalizeCoupleHome(p.id);return;}
    if(os.level){finalizeCoupleHome(other.id);return;}
    state.coupleHome={locationId:null,partnerId:other.id,ownerId:p.id};queueSystemAlert('🏠','先把家搭起来',`你和${other.name}现在还没有窝棚。以后两人中第一座建成的窝棚，会自动成为共同的家。`);
  }
  function shelterLevelDef(level){return (D.shelterLevels||[]).find(x=>x.level===level)||null;}
  function shelterOwnerAtLocation(locationId,exceptId=null){
    return state.characters.find(c=>c.id!==exceptId&&shelterOf(c).level&&shelterOf(c).locationId===locationId)||null;
  }
  function canBuildShelterAt(locationId,ownerId=null){
    if(locationId==='bamboo_clearing')return {ok:false,reason:'林中空地是公共营地，不能搭建个人窝棚'};
    const occupied=shelterOwnerAtLocation(locationId,ownerId);if(occupied)return {ok:false,reason:`${occupied.name}已经在这里搭建了窝棚`};
    return {ok:true,reason:''};
  }
  function effectiveCost(c,cost){
    const out={...cost};
    if(c?.id==='chenmo'){
      // 工程大师：每次建造/升级总成本至少节省1份材料，优先节省需求最多的材料。
      const ks=Object.keys(out).filter(k=>out[k]>0).sort((a,b)=>out[b]-out[a]);
      if(ks.length)out[ks[0]]=Math.max(0,out[ks[0]]-1);
    }
    return out;
  }
  function canAffordMaterials(cost){return Object.entries(cost||{}).every(([k,v])=>(camp().materials[k]||0)>=v);}
  function payMaterials(cost){for(const [k,v] of Object.entries(cost||{}))camp().materials[k]=Math.max(0,(camp().materials[k]||0)-v);}
  function halfCost(cost){const out={};for(const [k,v] of Object.entries(cost||{}))out[k]=Math.max(1,Math.ceil(v/2));return out;}
  function repairCampBuilding(id){const c=camp(),b=(D.campBuildings||[]).find(x=>x.id===id);if(!b||!c.damagedBuildings?.[id])return;if(player().locationId!==c.locationId){toast('要到公共营地才能修复');return;}const cost=effectiveCost(player(),halfCost(b.cost));if(!canAffordMaterials(cost)){toast('修复材料不足');return;}payMaterials(cost);delete c.damagedBuildings[id];log(`你修复了公共营地的${b.name}。`);sound('build');save();showCamp();}
  function repairOwnShelter(){const p=player(),s=shelterOf(p);if(!s.level||!s.damaged)return;if(p.locationId!==s.locationId){toast('要回到自己的窝棚才能修复');return;}const def=shelterLevelDef(s.level),cost=effectiveCost(p,halfCost(def.cost));if(!canAffordMaterials(cost)){toast('修复窝棚的材料不足');return;}payMaterials(cost);s.damaged=false;log(`${p.name}修复了${def.name}。`);sound('build');save();showShelter();}
  function repairShelterFacility(id){const p=player(),s=shelterOf(p),f=(D.shelterFacilities||[]).find(x=>x.id===id);if(!f||!s.damagedFacilities?.includes(id))return;if(p.locationId!==s.locationId){toast('要回到自己的窝棚才能修复设施');return;}const cost=effectiveCost(p,halfCost(f.cost));if(!canAffordMaterials(cost)){toast('修复设施的材料不足');return;}payMaterials(cost);s.damagedFacilities=s.damagedFacilities.filter(x=>x!==id);log(`${p.name}修复了窝棚里的${f.name}。`);sound('build');save();showShelter();}
  function shelterProtects(c,type){
    const s=homeShelterOf(c);if(!s.level||s.locationId!==c.locationId||s.damaged)return false;
    if(type==='rain')return s.level>=1;
    if(type==='beast')return s.level>=2;
    if(type==='heat')return s.level>=2;
    return false;
  }
  function buildOwnShelter(){
    const p=player(),s=shelterOf(p);if(s.level){toast('你已经有自己的窝棚');return;}
    if(!state.travelDecisionMade){toast('先决定今天停留的地点');return;}
    const buildCheck=canBuildShelterAt(p.locationId,p.id);if(!buildCheck.ok){toast(buildCheck.reason);return;}
    const def=shelterLevelDef(1),cost=effectiveCost(p,def.cost);
    if(!canAffordMaterials(cost)){toast('公共材料不足，暂时搭不起窝棚');return;}
    payMaterials(cost);s.locationId=p.locationId;s.level=1;s.facilities=[];s.damaged=false;s.damagedFacilities=[];log(`${p.name}在${locationById(p.locationId)?.name||'这里'}搭起了自己的${def.name}。`);if(state.coupleId&&!state.coupleHome?.locationId)finalizeCoupleHome(p.id);sound('build');save();showShelter();
  }
  function upgradeOwnShelter(){
    const p=player(),s=shelterOf(p);if(!s.level){buildOwnShelter();return;}if(s.level>=3){toast('窝棚已经升到最高等级');return;}if(p.locationId!==s.locationId){toast('要回到自己的窝棚所在地才能升级');return;}
    const next=shelterLevelDef(s.level+1),cost=effectiveCost(p,next.cost);if(!canAffordMaterials(cost)){toast('升级材料不足');return;}payMaterials(cost);s.level++;log(`${p.name}把自己的窝棚升级为${next.name}。`);sound('build');save();showShelter();
  }
  function installShelterFacility(id){
    const p=player(),s=shelterOf(p),f=(D.shelterFacilities||[]).find(x=>x.id===id);if(!f||!s.level)return;
    if(p.locationId!==s.locationId){toast('要回到自己的窝棚才能制作设施');return;}if((f.requiredLevel||1)>s.level){toast(`${f.name}需要窝棚达到Lv.${f.requiredLevel}才能制作`);return;}if(s.facilities.includes(id)){toast('这个设施已经有了');return;}if(s.facilities.length>=4){toast('窝棚最多只能放4件设施');return;}
    const cost=effectiveCost(p,f.cost);if(!canAffordMaterials(cost)){toast('制作设施的材料不足');return;}payMaterials(cost);s.facilities.push(id);log(`${p.name}在窝棚里制作了${f.name}。`);sound('build');save();showShelter();
  }
  function showShelter(){
    if(!state){toast('开始游戏后才能查看窝棚');return;}
    closeModal();const p=player(),s=shelterOf(p),labels={wood:'木材',fiber:'藤条',scrap:'零件'},c=camp();
    const resources=`<div class="campMaterials shelterResources"><span>🪵 木材 <b>${c.materials.wood||0}</b></span><span>🌿 藤条 <b>${c.materials.fiber||0}</b></span><span>⚙️ 零件 <b>${c.materials.scrap||0}</b></span><span>💧 净水 <b>${c.storedWater||0}</b></span><span>🐟 食物 <b>${c.storedFood||0}</b></span></div>`;
    if(!s.level){
      const def=shelterLevelDef(1),cost=effectiveCost(p,def.cost),afford=canAffordMaterials(cost),site=canBuildShelterAt(p.locationId,p.id),buildable=state.travelDecisionMade&&afford&&site.ok;
      const center=!site.ok?`<div class="shelterCenterNotice lack">${esc(site.reason)}</div>`:!afford?'<div class="shelterCenterNotice lack">材料不足</div>':'';
      modal(`<div class="row between"><h2>🏠 我的窝棚</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div>${resources}<p class="muted">你还没有自己的窝棚。个人窝棚不能建在公共营地，而且每个地点只能有一座个人窝棚。</p><div class="shelterBuildIntro shelterHero"><div class="shelterInteriorWrap"><img src="${def.image}" class="shelterInterior" alt="简易窝棚内部">${center}</div><div class="shelterBuildInfo"><b>${def.name}</b><span>${def.desc}</span><div class="materialTitle">需要材料</div>${materialCostHtml(cost)}</div></div><button class="btn" ${buildable?'':'disabled'} onclick="Game.buildOwnShelter()">在${esc(locationById(p.locationId)?.name||'当前位置')}搭建窝棚</button>`);return;
    }
    const def=shelterLevelDef(s.level),here=p.locationId===s.locationId,next=s.level<3?shelterLevelDef(s.level+1):null,nextCost=next?effectiveCost(p,next.cost):null,canUpgrade=!!(next&&here&&!s.damaged&&canAffordMaterials(nextCost)),repairCost=effectiveCost(p,halfCost(def.cost));
    const repairTxt=Object.entries(repairCost).map(([k,v])=>`${labels[k]}×${v}`).join(' · ');
    const facs=(D.shelterFacilities||[]).map(f=>{
      const built=s.facilities.includes(f.id),damaged=s.damagedFacilities?.includes(f.id),cost=effectiveCost(p,f.cost),repair=effectiveCost(p,halfCost(f.cost)),unlocked=s.level>=(f.requiredLevel||1);
      const costHtml=materialCostHtml(damaged?repair:cost);
      return `<div class="shelterFacility ${built?'built':''} ${damaged?'damaged':''} ${!unlocked?'lockedFacility':''}"><span class="facilityIcon">${f.icon}</span><div><b>${esc(f.name)} <i class="facilityLevel">Lv.${f.requiredLevel||1}</i> ${damaged?'<em class="damageTag">受损</em>':''}</b><small>${esc(f.desc)}</small>${!unlocked?`<em>窝棚升到 Lv.${f.requiredLevel} 解锁</em>`:built&&!damaged?'<em>已制作</em>':`<div class="facilityCost">${damaged?'修复需要':'需要'}${costHtml}</div>`}</div>${!unlocked?'🔒':damaged?`<button class="btn small danger" ${here&&canAffordMaterials(repair)?'':'disabled'} onclick="Game.repairShelterFacility('${f.id}')">修复</button>`:built?'✓':`<button class="btn small" ${here&&s.facilities.length<4&&canAffordMaterials(cost)?'':'disabled'} onclick="Game.installShelterFacility('${f.id}')">制作</button>`}</div>`;
    }).join('');
    const interior=here?`<div class="shelterInteriorWrap"><img src="${def.image}" class="shelterInterior" alt="${esc(def.name)}内部">${canUpgrade?`<button class="shelterCenterUpgrade" onclick="Game.upgradeOwnShelter()">⬆ 升级为 ${esc(next.name)}</button>`:''}</div>`:`<div class="awayShelter">🏠 回到 ${esc(locationById(s.locationId)?.name||'窝棚所在地')} 后可进入内部、升级和制作设施。</div>`;
    modal(`<div class="row between"><h2>🏠 ${state.coupleHome?.locationId?'我们的':'我的'}${esc(def.name)} · Lv.${s.level}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div>${resources}<div class="shelterLocation">📍 ${esc(locationById(s.locationId)?.name||'未知地点')} ${here?'<b>· 你正在这里，可以进入内部</b>':'· 你当前不在窝棚所在地'}</div>${interior}${s.damaged?`<div class="structureDamage"><b>⚠ 窝棚受损</b><span>损坏期间防护效果失效。修复需要：${repairTxt}</span><button class="btn small danger" ${here&&canAffordMaterials(repairCost)?'':'disabled'} onclick="Game.repairOwnShelter()">修复窝棚</button></div>`:''}<p class="shelterDesc">${esc(def.desc)}</p>${next?`<div class="shelterUpgradeNeed"><div class="materialTitle">升级为 ${esc(next.name)} 需要</div>${materialCostHtml(nextCost)}${!canUpgrade?`<div class="meta">${!here?'回到窝棚所在地后才能升级':s.damaged?'先修好窝棚再升级':canAffordMaterials(nextCost)?'已经达到升级条件':'材料还没攒够'}</div>`:''}</div>`:'<div class="maxShelter">★ 已达到最高等级</div>'}<div class="section-title" style="margin-top:14px">内部设施 ${s.facilities.length}/4</div><div class="shelterFacilityList">${facs}</div>`);
  }
  function applyShelterNightBenefits(){
    for(const c of alive()){
      const s=homeShelterOf(c);if(!s.level||c.locationId!==s.locationId)continue;
      const baseProtect=s.damaged?0:([0,.18,.35,.52][s.level]||0);if(chance(baseProtect))c.skipDecay=true;
      if(s.facilities.includes('hammock')&&!s.damagedFacilities?.includes('hammock')){c.nextCheckBonus=Math.max(c.nextCheckBonus,.08);if(chance(.28))c.skipDecay=true;}
      if(s.facilities.includes('water_filter')&&!s.damagedFacilities?.includes('water_filter')&&chance(.30))gainHealth(c,1);
      if(s.facilities.includes('medical_corner')&&!s.damagedFacilities?.includes('medical_corner')&&c.life<c.maxLife&&state.day-(s.lastMedicalDay||-99)>=5&&chance(.25)){addLife(c,1);s.lastMedicalDay=state.day;log(`${c.name}在自己的窝棚医疗角恢复了1点生命。`);}
    }
  }
  function npcUseCampSupplies(c){
    if(c.dead||c.locationId!==camp().locationId)return false;let used=false;
    if(c.health<=1&&camp().storedWater>0){camp().storedWater--;gainHealth(c,1);log(`${c.name}从公共营地取用了一份净水。`);used=true;}
    if(c.health<=2&&camp().storedFood>0&&!c.inventory.some(id=>item(id)?.kind==='food')){camp().storedFood--;gainItem(c,'grilled_fish','营地领取');const food=c.inventory.find(id=>item(id)?.kind==='food'&&item(id)?.effect?.health);if(food)useNpcItem(c,food);log(`${c.name}从公共营地取用了一份食物。`);used=true;}
    return used;
  }
  function npcShelterDecision(c){
    if(c.dead)return;const sharedPartner=!!(state.coupleHome?.locationId&&c.id===state.coupleId),s=sharedPartner?homeShelterOf(c):shelterOf(c),ai=Number(c.aiLevel||3);
    if(s.damaged&&c.locationId===s.locationId){const def=shelterLevelDef(s.level),cost=effectiveCost(c,halfCost(def.cost));if(canAffordMaterials(cost)&&chance(.025*ai)){payMaterials(cost);s.damaged=false;log(`${c.name}修好了自己的${def.name}。`);return;}}
    if(s.damagedFacilities?.length&&c.locationId===s.locationId&&chance(.02*ai)){const id=s.damagedFacilities[0],f=(D.shelterFacilities||[]).find(x=>x.id===id),cost=f?effectiveCost(c,halfCost(f.cost)):null;if(f&&canAffordMaterials(cost)){payMaterials(cost);s.damagedFacilities.shift();log(`${c.name}修好了窝棚里的${f.name}。`);return;}}
    if(sharedPartner)return;
    // 高智能NPC会在资源充足时搭建/升级自己的窝棚，但不会无节制抢光公共材料。
    const total=(camp().materials.wood||0)+(camp().materials.fiber||0)+(camp().materials.scrap||0);if(total<7)return;
    if(!s.level&&state.day>=6&&chance(.02*ai)){const def=shelterLevelDef(1),cost=effectiveCost(c,def.cost),site=canBuildShelterAt(c.locationId,c.id);if(site.ok&&canAffordMaterials(cost)){payMaterials(cost);s.locationId=c.locationId;s.level=1;s.facilities=[];s.damaged=false;s.damagedFacilities=[];log(`${c.name}在${locationById(c.locationId)?.name||'岛上'}搭起了自己的${def.name}。`,true);if(c.id===state.coupleId&&!state.coupleHome?.locationId)finalizeCoupleHome(c.id);}return;}
    if(s.level&&s.level<3&&c.locationId===s.locationId&&state.day>=12*s.level&&chance(.012*ai)){const def=shelterLevelDef(s.level+1),cost=effectiveCost(c,def.cost);if(canAffordMaterials(cost)){payMaterials(cost);s.level++;log(`${c.name}把自己的窝棚升级成了${def.name}。`);}}
    if(s.level&&s.facilities.length<4&&c.locationId===s.locationId&&chance(.01*ai)){const choices=(D.shelterFacilities||[]).filter(f=>!s.facilities.includes(f.id)&&(f.requiredLevel||1)<=s.level);if(choices.length){const f=[...choices].sort((a,b)=>NPC.itemValue({value:Object.values(b.cost).reduce((x,y)=>x+y,0)},c,state.day)-NPC.itemValue({value:Object.values(a.cost).reduce((x,y)=>x+y,0)},c,state.day))[0],cost=effectiveCost(c,f.cost);if(canAffordMaterials(cost)){payMaterials(cost);s.facilities.push(f.id);log(`${c.name}在自己的窝棚里做了${f.name}。`);}}}
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
    sound('warning');log(`大危机发生：${c.name}`);return {title:`${c.icon} ${c.name}`,text:`预告中的大危机终于到来。${extra.length?'\n'+extra.join('；'):'\n大家提前做了准备，顺利撑过了最危险的时刻。'}`,locationId:null,crisis:true};
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

  function applyFontSize(){
    const allowed=['small','medium','large'];if(!allowed.includes(fontSizePref))fontSizePref='medium';
    document.documentElement.dataset.fontSize=fontSizePref;
  }
  function setFontSize(size){
    if(!['small','medium','large'].includes(size))return;fontSizePref=size;localStorage.setItem(FONT_KEY,size);applyFontSize();sound('click');closeModal();showOverview();
  }
  function ensureBgm(){
    if(!soundEnabled||bgmChoice==='off')return null;const track=BGM_TRACKS[bgmChoice]||Object.values(BGM_TRACKS).find(t=>t.src);if(!track||!track.src)return null;
    if(!bgmAudio){bgmAudio=new Audio();bgmAudio.loop=true;bgmAudio.preload='auto';bgmAudio.playsInline=true;bgmAudio.volume=.26;}
    if(bgmAudio.dataset.track!==bgmChoice){bgmAudio.pause();bgmAudio.src=track.src;bgmAudio.dataset.track=bgmChoice;bgmAudio.load();}
    return bgmAudio;
  }
  function tryStartBgm(){
    if(!soundEnabled||bgmChoice==='off')return;const a=ensureBgm();if(!a)return;if(a.paused)a.play().catch(()=>{});
  }
  function setBgm(choice){
    if(!BGM_TRACKS[choice])return;bgmChoice=choice;localStorage.setItem(BGM_KEY,choice);
    if(bgmAudio){bgmAudio.pause();bgmAudio.currentTime=0;bgmAudio=null;}
    if(choice!=='off'&&soundEnabled)tryStartBgm();sound('click');closeModal();showOverview();
  }
  function pauseBgm(){if(bgmAudio&&!bgmAudio.paused)bgmAudio.pause();}

  function ensureAudio(){
    if(!soundEnabled) return null;
    try{
      if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      return audioCtx;
    }catch{return null;}
  }
  async function unlockAudio(){
    if(soundEnabled){
      const ctx=ensureAudio();if(ctx){try{if(ctx.state==='suspended')await ctx.resume();const buffer=ctx.createBuffer(1,1,22050),src=ctx.createBufferSource(),g=ctx.createGain();g.gain.value=.00001;src.buffer=buffer;src.connect(g);g.connect(ctx.destination);src.start(0);}catch(e){console.warn('audio unlock failed',e);}}
    }
    tryStartBgm();
  }
  function playTone(kind){
    const ctx=ensureAudio();if(!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime;
    const patterns={
      day:[[520,.00,.13,'sine'],[660,.08,.16,'sine'],[820,.17,.18,'triangle']],
      card:[[620,.00,.06,'triangle'],[760,.045,.07,'triangle']],
      good:[[660,.00,.08,'sine'],[880,.07,.13,'sine']],
      heal:[[620,.00,.10,'sine'],[790,.07,.13,'sine'],[980,.14,.16,'triangle']],
      bad:[[210,.00,.12,'sawtooth'],[145,.08,.16,'sawtooth']],
      battle:[[180,.00,.07,'square'],[125,.055,.13,'sawtooth'],[230,.13,.09,'square']],
      warning:[[300,.00,.09,'square'],[300,.13,.09,'square']],
      night:[[260,.00,.15,'sine'],[205,.12,.22,'sine']],
      encounter:[[360,.00,.07,'triangle'],[450,.065,.10,'triangle']],
      trade:[[520,.00,.07,'sine'],[690,.06,.10,'sine']],
      move:[[430,.00,.06,'triangle'],[570,.055,.09,'triangle']],
      click:[[600,.00,.045,'sine']],
      build:[[390,.00,.08,'triangle'],[520,.07,.10,'triangle'],[690,.15,.13,'sine']],
      story:[[690,.00,.10,'sine'],[840,.08,.13,'sine'],[1040,.16,.16,'triangle']],
      victory:[[523,.00,.22,'sine'],[659,.16,.24,'sine'],[784,.34,.30,'triangle'],[1046,.58,.42,'sine']],
      defeat:[[220,.00,.24,'sine'],[185,.18,.32,'sine'],[147,.42,.48,'triangle']]
    };
    const pattern=patterns[kind]||patterns.click;
    for(const [freq,delay,dur,type] of pattern){
      const o=ctx.createOscillator(),g=ctx.createGain(),start=now+delay;
      o.type=type;o.frequency.setValueAtTime(freq,start);
      if(kind==='bad'||kind==='battle')o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.72),start+dur);
      g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(.095,start+.012);g.gain.exponentialRampToValueAtTime(.0001,start+dur);
      o.connect(g);g.connect(ctx.destination);o.start(start);o.stop(start+dur+.025);
    }
  }
  function sound(kind){
    const ctx=ensureAudio();if(!ctx)return;
    if(ctx.state==='suspended'){ctx.resume().then(()=>playTone(kind)).catch(()=>{});return;}
    playTone(kind);
  }
  function toggleSound(){
    soundEnabled=!soundEnabled;localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0');
    if(soundEnabled){unlockAudio();sound('click');}
    else{pauseBgm();try{if(audioCtx&&audioCtx.state==='running')audioCtx.suspend();}catch(e){}}
    render();
  }
  function showStatFx(type,delta){
    if(!state||!delta) return;
    const positive=delta>0, label=type==='life'?'生命':'健康';
    const el=document.createElement('div'); el.className=`statFx ${positive?'plus':'minus'}`; el.innerHTML=`<b>${label}</b> ${positive?'+':''}${delta}`; document.body.appendChild(el); setTimeout(()=>el.remove(),1050); sound(positive?'good':'bad');
  }
  function showConversionFx(times=1,lifeGain=0){
    const el=document.createElement('div');el.className='conversionFx';el.innerHTML=`<b>状态充盈</b><span>健康达到上限 → ${lifeGain>0?`生命 +${lifeGain}`:'生命已满'} · 健康变为 1</span>`;document.body.appendChild(el);sound('heal');setTimeout(()=>el.classList.add('show'),20);setTimeout(()=>el.classList.remove('show'),1300);setTimeout(()=>el.remove(),1650);
  }
  function showDayTransition(){
    const p=player(),loc=locationById(p.locationId),low=p.life<2,cr=state.crisisNotice;
    const crisisLine=cr?`<div class="dayCrisis">${cr.icon} ${esc(cr.name)} · ${cr.left===0?'今晚来临':`${cr.left}天后`}</div>`:'';
    const el=document.createElement('div');el.className='dayTransition';el.innerHTML=`<div class="dayTransitionInner">${portrait(p,'dayPortrait')}<div class="dayBig">DAY ${state.day}</div><div class="dayLoc">${loc?`清晨 · ${esc(loc.name)}`:'新的一天'}</div>${crisisLine}${low?'<div class="lifeWarning">⚠ 生命值低于2 · 情况危险</div>':''}</div>`;document.body.appendChild(el);sound('day');setTimeout(()=>el.classList.add('show'),20);setTimeout(()=>el.classList.remove('show'),1200);setTimeout(()=>el.remove(),1550);
  }
  function richText(text){
    let html=esc(text||'');
    const itemNames=Object.values(D.items).map(x=>x.name).sort((a,b)=>b.length-a.length);
    const roleNames=(state?.characters||D.characters||[]).map(x=>x.name).filter(Boolean).sort((a,b)=>b.length-a.length);
    const placeNames=(D.locations||[]).map(x=>x.name).sort((a,b)=>b.length-a.length);
    for(const name of itemNames)html=html.replace(new RegExp(regexEsc(esc(name)),'g'),`<strong class="itemName">${esc(name)}</strong>`);
    for(const name of roleNames)html=html.replace(new RegExp(regexEsc(esc(name)),'g'),`<strong class="roleName">${esc(name)}</strong>`);
    for(const name of placeNames)html=html.replace(new RegExp(regexEsc(esc(name)),'g'),`<strong class="placeName">${esc(name)}</strong>`);
    html=html.replace(/(木材|藤条|零件)([+＋×xX]?\d+)?/g,'<strong class="materialName">$1$2</strong>');
    html=html.replace(/(生命(?:值)?[+＋-]\d+|健康(?:值)?[+＋-]\d+|关系(?:提升|下降|改善|恶化)|生死之交|情侣|敌对|信任)/g,'<strong class="keyState">$1</strong>');
    return html.replace(/\n/g,'<br>');
  }
  function richResultText(text){
    return richText(text||'').replace(/；/g,'<br>');
  }
  function materialCostHtml(cost){
    const labels={wood:'木材',fiber:'藤条',scrap:'零件'},icons={wood:'🪵',fiber:'🌿',scrap:'⚙️'},m=camp().materials||{};
    return `<div class="materialCosts">${Object.entries(cost||{}).map(([k,v])=>`<span class="materialNeed ${(m[k]||0)>=v?'enough':'lack'}">${icons[k]||''}<b>${labels[k]||k}</b> ${m[k]||0}/${v}</span>`).join('')}</div>`;
  }
  function typeText(el,text,done){
    if(!el){ done?.(); return; }
    let i=0; el.textContent=''; const choices=document.getElementById('eventChoices'); if(choices)choices.classList.add('typingLocked');
    const tick=()=>{ if(i>=text.length){ el.innerHTML=richText(text); if(choices)choices.classList.remove('typingLocked'); done?.(); return; } el.textContent+=text[i++]; setTimeout(tick,Math.max(8,Math.min(22,16+(text[i-1]==='。'?20:0)))); };
    tick();
  }

  function difficultyRules(key){
    const b={...DEFAULT_GAME_CONFIG.difficulty,...GAME_CONFIG.difficulty};
    // v1.6 平衡目标：普通难度约50%通关；NPC前30/50天死亡率分别控制在20%/50%以下。
    if(key==='easy') return {...b,nightEventChance:clamp(b.nightEventChance-.10,.30,.80),baseCheckModifier:clamp(b.baseCheckModifier+.10,-.20,.30),healthDecayChance:clamp(b.healthDecayChance-.22,.45,.90),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance+.10,0,.70),startingBonusFood:clamp((b.startingBonusFood||0)+3,0,5)};
    if(key==='hard') return {...b,nightEventChance:clamp(b.nightEventChance+.08,.40,.90),baseCheckModifier:clamp(b.baseCheckModifier-.06,-.25,.20),healthDecayChance:clamp(b.healthDecayChance,0.70,1),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance-.08,0,.55),startingBonusFood:clamp(b.startingBonusFood||0,0,3)};
    return {...b,nightEventChance:clamp(b.nightEventChance-.02,.45,.85),baseCheckModifier:clamp(b.baseCheckModifier+.025,-.20,.22),healthDecayChance:clamp(b.healthDecayChance-.04,.48,.96),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance+.03,0,.58),startingBonusFood:clamp((b.startingBonusFood||0)+1,0,5)};
  }

  function makeChar(base){ return {...base,life:base.maxLife,health:3,inventory:[base.startItem],locationId:null,dead:false,deathDay:null,deathCause:'',healthyStreak:0,abilityCooldown:0,lowLifeSeen:false,skipDecay:false,damageShield:0,generalShield:0,nextCheckBonus:0,dayStartHealth:3,raincoatUsed:false,lifevestUsed:false,shelter:{locationId:null,level:0,facilities:[],lastMedicalDay:-99,damaged:false,damagedFacilities:[]},aiExplored:{},stats:{battles:0,wins:0,trades:0,avoids:0,itemsFound:1,itemsUsed:0}}; }
  function newState(playerId,difficultyKey){
    const seed=`${Date.now()}-${Math.random()}`;
    let rs=hashSeed(seed);
    const chars=D.characters.map(makeChar);
    for(const c of chars){ const step=randStep(rs); rs=step[0]; c.locationId=D.locations[Math.floor(step[1]*D.locations.length)].id; }
    const currentRules=difficultyRules(difficultyKey);
    const crisisGen=generateCrises(rs); rs=crisisGen.rngState;
    const s={version:25,seed,rngState:rs,day:1,phase:'PREPARE',playerId,difficultyKey,difficultyLabel:DIFFICULTY_META[difficultyKey]?.label||'正常',characters:chars,rules:currentRules,relationships:{},freeTrades:{},recentPlayerEvents:[],recentNpcEvents:[],recentInteractionEvents:[],recentLocationEvents:{},currentEvent:null,eventResolved:false,currentResult:'',nightDanger:0,rescueScore:0,history:[],statistics:{battles:0,battleWins:0,trades:0,itemsUsed:0,itemsFound:0,foodUsed:0,risksTaken:0},pending:null,lastNight:null,score:null,selectedLocationId:null,exploredLocations:{},completedExploreLocations:{},movedToday:false,exploredToday:false,interactedTargetsToday:[],socialActionUsedToday:false,socialActionTargetId:null,interactionScenesToday:{},travelDecisionMade:false,locationLockedToday:false,locationBrief:'',interaction:null,travelEvent:null,travelContext:null,travelEventResult:'',travelInteractionPending:false,recentTravelEvents:[],recentCoupleEvents:[],coupleId:null,leaderboard:{submitted:false},camp:{locationId:'bamboo_clearing',materials:{wood:0,fiber:0,scrap:0},buildings:{},damagedBuildings:{},storedFood:0,storedWater:0,lastFoodDay:0,lastWaterDay:0},allExploredRewarded:false,deathAlerts:[],relationAlerts:[],systemAlerts:[],shelterBuildReminderShown:false,dailyActionOrder:[],npcActedToday:[],endSceneSeen:false,lastIntimateEvent:null,coupleHome:null,coupleHomeChoice:null,nightInteractionLog:[],stories:Object.fromEntries((D.storyChains||[]).map(s=>[s.id,{started:false,step:0,nextDay:0,completed:false,branch:''}])),crises:crisisGen.crises,crisisNotice:null,firstMeetings:{},dailyAnimals:{},animalInteractedToday:[],animalInteraction:null,recentAnimalEvents:{}};
    const bonusFoods=['coconut','banana'].slice(0,currentRules.startingBonusFood||0);
    s.characters.forEach(c=>{ c.inventoryLimit=currentRules.inventoryLimit; for(const id of bonusFoods){ if(canAddUnit(c,id))c.inventory.push(id); } });
    const pc=s.characters.find(c=>c.id===playerId); s.exploredLocations[pc.locationId]=true;
    return s;
  }

  function addHealth(c,n){
    const beforeHealth=c.health,beforeLife=c.life;let converted=0,blockedAtMax=false;
    if(n>0){
      const target=c.health+n;
      if(target<=3)c.health=target;
      else if(c.life<c.maxLife){c.life=clamp(c.life+1,0,c.maxLife);c.health=1;converted=1;if(c.id===state?.playerId)showStatFx('life',1);}
      else{c.health=3;blockedAtMax=true;}
    }else if(n<0)c.health=clamp(c.health+n,0,3);
    const d=c.health-beforeHealth;
    if(c.id===state?.playerId&&d&&!converted)showStatFx('health',d);
    if(c.id===state?.playerId&&converted)showConversionFx(converted,c.life-beforeLife);
    c.lastHealthConversion=converted;c.lastHealthBlockedAtMax=blockedAtMax;
    return d;
  }
  function addLife(c,n){
    const before=c.life,beforeHealth=c.health;c.lastLifeOverflow=false;
    if(n>0&&c.life>=c.maxLife){c.health=3;c.lastLifeOverflow=true;const hd=c.health-beforeHealth;if(c.id===state?.playerId&&hd)showStatFx('health',hd);return 0;}
    c.life=clamp(c.life+n,0,c.maxLife);const d=c.life-before;if(c.id===state?.playerId&&d)showStatFx('life',d);return d;
  }
  function gainLife(c,n){const beforeH=c.health,beforeL=c.life;const d=addLife(c,n);if(c.lastLifeOverflow)return c.health>beforeH?'生命已满，健康补满':'生命与健康都已达到最高值';return `生命+${Math.max(0,c.life-beforeL)}`;}
  function gainHealth(c,n){
    const beforeH=c.health,beforeL=c.life;addHealth(c,n);
    if(c.lastHealthConversion){const gained=c.life-beforeL;return `状态充盈：生命+${gained}，健康变为1`;}
    if(c.lastHealthBlockedAtMax&&c.life>=c.maxLife&&c.health===3)return '生命与健康都已达到最高值';
    const d=c.health-beforeH;return `健康+${Math.max(0,d)}`;
  }
  function healthDamage(c,n){ if(n<=0)return 0; if(c.generalShield>0){c.generalShield--;return 0;} const b=c.health;c.health=clamp(c.health-n,0,3);const d=b-c.health;if(c.id===state?.playerId&&d)showStatFx('health',-d);return d; }
  function applyDamage(c,n,cause='受伤'){ 
    if(n<=0)return 0;if(c.generalShield>0){c.generalShield--;return 0;}if(c.damageShield>0){c.damageShield--;return 0;}if(c.id==='zhouye'&&chance(.55)){if(c.id===state?.playerId)toast('救援专家：抵消了这次生命伤害');return 0;}
    const wouldDie=c.life-n<=0;c.life-=n;
    if(c.id===state?.playerId)showStatFx('life',-n);
    // 非主角早期更倾向于被同伴照应，避免前半局NPC过快大量死亡。
    if(wouldDie&&c.id!==state?.playerId){const saveP=state.day<=30?Number(rules().npcSaveChanceDay30??.84):state.day<=50?Number(rules().npcSaveChanceDay50??.66):state.day<=60?Number(rules().npcSaveChanceDay60??.62):0;if(saveP>0&&chance(saveP)){c.life=1;c.health=Math.max(c.health,0);c.lowLifeSeen=true;log(`${c.name}在危险中勉强撑住了，没有当场死亡。`);return n;}}
    if(c.life<=1)c.lowLifeSeen=true;if(c.life<=0)kill(c,cause);return n; 
  }
  function kill(c,cause){ c.life=0;c.dead=true;c.deathDay=state.day;c.deathCause=cause;c.inventory=[];log(`${c.name}在DAY ${state.day}死亡：${cause}`);if(c.id!==state?.playerId){state.deathAlerts=state.deathAlerts||[];state.deathAlerts.push({id:c.id,name:c.name,portrait:c.portrait,day:state.day,cause});} }
  function breakItem(c,id,reason='损坏'){ if(!has(c,id)||isStarterItem(c,id))return false;if(c.id==='chenmo'&&chance(.70)){log(`${c.name}修好了${item(id).name}`);return false;}c.inventory.splice(c.inventory.indexOf(id),1);log(`${c.name}的${item(id).name}${reason}`);return true; }
  function gainItem(c,id,source='获得'){
    if(!D.items[id])return false;
    const it=item(id);
    if(c.inventory.includes(id)&&!it.consumable){if(c.id===state.playerId)toast(`已有${it.name}，效果不能叠加`);return false;}
    if(canAddUnit(c,id)){c.inventory.push(id);c.stats.itemsFound++;if(c.id===state.playerId){state.statistics.itemsFound++;toast(`${source}：${it.name}`);sound('good');}return true;}
    if(c.id===state.playerId){state.pending={type:'replace',incoming:id};save();render();return false;}
    const candidates=discardableItems(c);if(!candidates.length)return false;
    const discard=[...new Set(candidates)].sort((a,b)=>NPC.itemValue(item(a),c,state.day)-NPC.itemValue(item(b),c,state.day))[0];
    if(NPC.itemValue(item(discard),c,state.day)>NPC.itemValue(it,c,state.day))return false;
    removeInventoryUnit(c,discard);c.inventory.push(id);return true;
  }
  function gainItems(c,ids,source='获得'){
    const gained=[];for(const id of (ids||[]).slice(0,3)){if(gainItem(c,id,source))gained.push(id);if(state.pending)break;}
    return gained;
  }
  function maybeMultiItemReward(c,source='意外发现',chanceValue=.07,maxCount=3){
    if(!chance(chanceValue)||invUsedSlots(c)>=invLimit(c))return '';
    const count=1+Math.floor(rng()*Math.max(1,Math.min(3,maxCount)));const ids=[];for(let i=0;i<count;i++)ids.push(randomItem());
    const got=gainItems(c,ids,source);return got.length?`${source}：${got.map(id=>item(id).name).join('、')}`:'';
  }
  function weightedItem(ids){
    const pool=(ids||[]).filter(id=>item(id));if(!pool.length)return null;let total=0;const rows=pool.map(id=>{const it=item(id);let w=Number(it.dropWeight);if(!Number.isFinite(w)){if(it.starter)w=0;else if(it.consumable)w=it.value>=9?.55:it.value>=7?.85:1.15;else w=it.value>=9?.48:it.value>=7?.68:.85;}w=Math.max(.05,w);total+=w;return [id,w];});let r=rng()*total;for(const [id,w] of rows){r-=w;if(r<=0)return id;}return rows[rows.length-1][0];
  }
  function randomItem(filter){ if(filter)return weightedItem(filter);const foodChance=state.day<=20?.54:state.day<=40?.50:state.day<=60?.46:.43;const x=rng();if(x<foodChance)return weightedItem(D.foodPool);if(x<foodChance+.14)return weightedItem(D.medicalPool);return weightedItem(D.itemPool.filter(id=>D.items[id].kind==='gear'||D.items[id].kind==='special')); }
  function highItem(){return rand(D.itemPool.filter(id=>(item(id).value||0)>=8));}

  function useItem(c,id){
    const idx=c.inventory.indexOf(id);if(idx<0)return;const it=item(id);if(!it.consumable)return;if(id==='flare'&&state.day<61){toast('DAY 61以后再使用信号弹更有意义');return;}
    let consumed=true,msg='';
    if(it.effect?.wildFood){if(chance(.75)){addHealth(c,1);msg='野果没问题，健康+1';}else{healthDamage(c,1);msg='野果让你不舒服，健康-1';}}
    else{if(it.effect?.health){let n=it.effect.health;if(it.effect.extraHealthChance&&chance(it.effect.extraHealthChance))n++;msg=gainHealth(c,n);}if(it.effect?.life){msg=gainLife(c,it.effect.life);}if(it.effect?.skipDecay){c.skipDecay=true;msg+=(msg?'，':'')+'今晚不自然下降健康';}if(it.effect?.shield){c.damageShield+=it.effect.shield;msg='下一次生命伤害将被抵消';}if(it.effect?.generalShield){c.generalShield+=it.effect.generalShield;msg='下一次健康或生命损失将被抵消';}if(it.effect?.nextCheckBonus){c.nextCheckBonus=Math.max(c.nextCheckBonus,it.effect.nextCheckBonus);msg+=(msg?'，':'')+'下一次检定更稳';}if(it.effect?.rescueScore){state.rescueScore+=it.effect.rescueScore;msg='你在高地打出信号，求救努力+2';}}
    if(c.id==='linlan'&&it.kind==='medical'){if(it.effect?.life){const extra=addLife(c,1);if(extra)msg+=(msg?'，':'')+'急救专家：生命额外+1';}if(it.effect?.shield)c.damageShield++;if(it.effect?.generalShield)c.generalShield++;}
    if(c.id==='gaoyuan'&&it.kind==='food'){if(it.effect?.health&&msg&&!msg.includes('生命')){const extra=gainHealth(c,1);msg+=(msg?'，':'')+`料理大师：${extra}`;}if(chance(.60))consumed=false;}else if(it.kind==='food'&&c.shelter?.facilities?.includes('stove')&&!c.shelter?.damagedFacilities?.includes('stove')&&c.locationId===c.shelter.locationId&&it.effect?.health){const extra=gainHealth(c,1);msg+=(msg?'，':'')+`炉灶加成：${extra}`;}if(consumed)c.inventory.splice(idx,1);c.stats.itemsUsed++;if(c.id===state.playerId){state.statistics.itemsUsed++;if(it.kind==='food')state.statistics.foodUsed++;toast(`${it.name}：${msg}${consumed?'':'（没有消耗）'}`);}save();render();
  }

  function checkChance(c,stat,difficulty='normal',tags=[]){
    const base={2:.30,3:.45,4:.60,5:.75}[effectiveStat(c,stat)]||.45;
    let p=base+(difficulty==='easy'?.15:difficulty==='hard'?-.20:0)+(c.nextCheckBonus||0)+(rules().baseCheckModifier||0);
    if(stat==='luck')p+=gearMod(c,'luck');
    if(tags.includes('climb'))p+=gearMod(c,'climb');
    if(tags.includes('mechanic'))p+=gearMod(c,'mechanic');
    if(tags.includes('fish'))p+=gearMod(c,'fish');
    if(tags.includes('fire'))p+=gearMod(c,'fire');
    if(tags.includes('resource'))p+=gearMod(c,'resource');
    if(tags.includes('water'))p+=gearMod(c,'water');
    if(tags.includes('explore'))p+=gearMod(c,'explore');
    if(tags.includes('medical'))p+=gearMod(c,'medical');
    if(tags.includes('food'))p+=gearMod(c,'foodPrep');
    if(c.id==='suqing'&&tags.includes('explore'))p+=.18;
    if(c.id==='zhouye'&&tags.includes('climb'))p+=.20;
    if(c.id==='linlan'&&tags.includes('medical'))p+=.25;
    if(c.id==='gaoyuan'&&tags.includes('food'))p+=.15;
    if(c.id==='chenmo'&&tags.includes('mechanic'))p+=.20;
    if(c.id==='xutang')p+=.10;
    c.nextCheckBonus=0;p=clamp(p,.10,.97);let ok=chance(p);
    if(!ok&&c.id==='xutang'){const last=c.lastRetryDay||-99;if(state.day-last>=3){c.lastRetryDay=state.day;ok=chance(p);if(c.id===state.playerId)toast('知识洞博：自动重试一次');}}
    return ok;
  }
  function applyEffect(c,effect={},context='事件'){
    const msgs=[],who=c.id===state.playerId?'你':c.name;
    if(effect.none)msgs.push(`${who}没有受到额外影响`);
    if(effect.health){if(effect.health>0)msgs.push(`${who}${gainHealth(c,effect.health)}`);else{const n=healthDamage(c,-effect.health);msgs.push(`${who}健康-${n}`);}}
    if(effect.life){if(effect.life>0)msgs.push(`${who}${gainLife(c,effect.life)}`);else{const n=applyDamage(c,-effect.life,context);msgs.push(`${who}生命-${n}`);}}
    if(effect.skipDecay){c.skipDecay=true;msgs.push(`${who}今晚不会因日常消耗降低健康`);}
    if(effect.nextCheckBonus){c.nextCheckBonus=Math.max(c.nextCheckBonus,effect.nextCheckBonus);msgs.push(`${who}下一次检定获得加成`);}
    const itemMsg=id=>`${who}收到${item(id).name}+1`;
    if(effect.item){gainItem(c,effect.item);msgs.push(itemMsg(effect.item));}
    if(effect.items){const ids=(effect.items||[]).slice(0,3),got=gainItems(c,ids);if(got.length)msgs.push(`${who}收到${got.map(id=>`${item(id).name}+1`).join('、')}`);}
    if(effect.randomItems){const ids=[];for(let i=0;i<Math.min(3,Number(effect.randomItems)||0);i++)ids.push(randomItem());const got=gainItems(c,ids);if(got.length)msgs.push(`${who}收到${got.map(id=>`${item(id).name}+1`).join('、')}`);}
    if(effect.randomItem){const id=randomItem();gainItem(c,id);msgs.push(itemMsg(id));}
    if(effect.randomHighItem){const id=highItem();gainItem(c,id);msgs.push(itemMsg(id));}
    if(effect.randomFood){const id=randomItem(D.foodPool);gainItem(c,id);msgs.push(itemMsg(id));}
    if(effect.randomFrom){const id=rand(effect.randomFrom);gainItem(c,id);msgs.push(itemMsg(id));}
    if(effect.randomItemChance){if(chance(effect.randomItemChance)){const id=randomItem();gainItem(c,id);msgs.push(itemMsg(id));}else msgs.push('翻了半天，只收获了一手灰');}
    if(effect.pickItems){const choices=[];while(choices.length<effect.pickItems){const id=randomItem();if(!choices.includes(id))choices.push(id);}if(c.id===state.playerId){state.pending={type:'pick',choices};msgs.push(`你发现${effect.pickItems}件物资，可以挑1件带走`);}else{const id=[...choices].sort((a,b)=>NPC.itemValue(item(b),c,state.day)-NPC.itemValue(item(a),c,state.day))[0];gainItem(c,id);msgs.push(itemMsg(id));}}
    if(effect.loseItem){const lost=loseRandomItem(c);msgs.push(lost?`${who}丢失${item(lost).name}-1`:`${who}及时护住了背包，没有丢东西`);}
    if(effect.loseFood){const foods=c.inventory.filter(id=>item(id).kind==='food');if(foods.length){const hs=homeShelterOf(c);if(hs?.facilities?.includes('drying_rack')&&!hs?.damagedFacilities?.includes('drying_rack')&&c.locationId===hs.locationId){msgs.push('干燥架救下了这批食物，今天不用心疼');}else{const id=rand(foods);c.inventory.splice(c.inventory.indexOf(id),1);msgs.push(`${who}的${item(id).name}腐坏-1`);}}else msgs.push(`${who}没有食物可坏，多少有点心酸`);}
    if(effect.achievement)unlock(effect.achievement);
    if(effect.rescueScore){state.rescueScore+=effect.rescueScore;msgs.push(`求救努力+${effect.rescueScore}`);}
    if(effect.nightDanger){state.nightDanger+=effect.nightDanger;msgs.push('今晚的风险悄悄升高了');}
    if(effect.fromNpc){const donor=alive().filter(x=>x.id!==c.id&&tradableItems(x).length);if(donor.length){const d=rand(donor),pool=tradableItems(d),iid=[...pool].sort((a,b)=>NPC.itemValue(D.items[a],d,state.day)-NPC.itemValue(D.items[b],d,state.day))[0];d.inventory.splice(d.inventory.indexOf(iid),1);gainItem(c,iid);msgs.push(`${d.name}给${who}${item(iid).name}+1`);}else msgs.push('附近没有人能腾出多余物资');}
    if(effect.campMaterial){addCampMaterial(effect.campMaterial);const labels={wood:'木材',fiber:'藤条',scrap:'零件'};msgs.push(`公共材料增加：${Object.entries(effect.campMaterial).map(([k,v])=>`${labels[k]||k}+${v}`).join('、')}`);}
    if(effect.relationTo){const o=cBy(effect.relationTo);if(o){const d=effect.relation||0,actual=changeRelation(c,o,d,'剧情选择');msgs.push(`${o.name}跟${who}的关系${actual>=0?'提升':'下降'}${Math.abs(actual)}，${Math.abs(actual)>10?(actual>0?'明显更亲近了':'彼此明显疏远了'):'彼此的态度有所改变'}`);}}
    if(effect.relationRandom){const o=randomOther(c);if(o){const d=effect.relationRandom,actual=changeRelation(c,o,d,'剧情选择');msgs.push(`${o.name}跟${who}的关系${actual>=0?'提升':'下降'}${Math.abs(actual)}`);}}
    if(effect.relationAll){const changes=alive().filter(x=>x.id!==c.id).map(o=>changeRelation(c,o,effect.relationAll,'共同经历')).filter(Boolean);const amt=changes.length?Math.max(...changes.map(Math.abs)):Math.abs(scaledRelationDelta(effect.relationAll));msgs.push(`${who}与其他幸存者的关系普遍${effect.relationAll>=0?'提升':'下降'}${amt}`);}
    return msgs.join('；');
  }
  function checkNarrative(e,stat,ok,effect=''){
    const action=e?.name||'这件事',success={str:'你稳住力气，把最费劲的部分一点点解决了',agi:'你反应够快，动作比意外先了一步',int:'你先观察了一阵，判断基本靠谱',luck:'今天运气站在你这边，事情比预想顺利'}[stat]||'你把事情处理得还不错',fail={str:'你使了几次劲，最后还是差那么一点',agi:'你已经很小心，但脚下还是慢了半拍',int:'你想了好一会儿，还是漏掉了关键细节',luck:'今天运气有点偷懒，没有帮上忙'}[stat]||'事情没按计划发展';
    return `${ok?success:fail}。${effect||`${action}没有带来额外变化。`}`;
  }

  function loseRandomItem(c){if(has(c,'drybag'))return null;const pool=lootableItems(c);if(!pool.length)return null;const id=rand(pool);c.inventory.splice(c.inventory.indexOf(id),1);return id;}
  function beastHazard(c){if(campProtection(c,'beast'))return '营地警戒与遮蔽让野兽没有靠近';if(has(c,'torch')){if(chance(.3))breakItem(c,'torch');return '火把吓退了野兽';}const ok=checkChance(c,'agi','normal',[]);if(ok)return '成功躲开';applyDamage(c,1,'野兽袭击');return '遭到袭击，生命-1';}
  function rainHazard(c){if(campProtection(c,'rain'))return '营地遮雨棚挡住了暴雨';if(has(c,'tarp'))return '雨布挡住了暴雨';if(has(c,'raincoat')&&!c.raincoatUsed){c.raincoatUsed=true;breakItem(c,'raincoat');return '破旧雨衣挡住了这一次暴雨';}healthDamage(c,1);return '健康-1';}

  function chooseLocationEvent(locationId,forNpc=false){
    if(!forNpc){const se=storyEventForLocation(locationId);if(se){sound('story');return se;}}
    const globalRecent=forNpc?state.recentNpcEvents:state.recentPlayerEvents;
    const localRecent=forNpc?[]:(state.recentLocationEvents[locationId]||(state.recentLocationEvents[locationId]=[]));
    const base=D.locationEvents.filter(e=>e.location===locationId&&(!e.minDay||state.day>=e.minDay));
    let pool=base.filter(e=>!globalRecent.includes(e.id)&&!localRecent.includes(e.id));
    if(!pool.length)pool=base.filter(e=>!localRecent.includes(e.id));
    if(!pool.length)pool=base;
    if(!pool.length)pool=D.locationEvents.filter(e=>!e.minDay||state.day>=e.minDay);
    const e=rand(pool);globalRecent.push(e.id);if(globalRecent.length>Math.max(12,Number(rules().eventRecentWindow||24)))globalRecent.shift();
    if(!forNpc){localRecent.push(e.id);if(localRecent.length>4)localRecent.shift();}
    return e;
  }
  function playerForcedRestToday(){const p=player();return !!p&&p.exhaustedDay===state.day;}
  function forcedRestAction(){
    const p=player();if(!playerForcedRestToday())return;state.travelDecisionMade=true;state.locationLockedToday=true;state.exploredToday=true;state.interactedTargetsToday=locationPeers().map(c=>c.id);p.skipDecay=true;state.currentResult='昨夜你几乎没怎么合眼。今天最聪明的决定，就是老老实实躺着休息——偶尔什么都不做，也是一种求生技术。';state.phase='POST_ACTION';log(`${p.name}因为疲惫留在原地休整了一整天。`);save();render();
  }
  function exploreCurrent(){
    if(!['LOCATION','POST','POST_ACTION'].includes(state.phase)||state.currentEvent)return;
    if(state.exploredToday){toast('今天已经探索过一次');return;}
    const p=player(),loc=locationById(p.locationId);if(!loc)return;
    state.exploredToday=true;state.locationLockedToday=true;state.selectedLocationId=p.locationId;state.exploredLocations[p.locationId]=true;state.currentEvent=chooseLocationEvent(p.locationId,false);state.phase='EVENT';log(`你在${loc.name}展开今天唯一一次探索。`);sound('card');save();render();
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
    const c=player(),e=state.currentEvent;if(!e||state.eventResolved)return;let result='';if(e.type==='instant')result=applyEffect(c,e.effect,e.name);else if(e.type==='hazard')result=e.hazard==='beast'?beastHazard(c):rainHazard(c);else if(e.type==='check'){const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]),eff=applyEffect(c,ok?e.success:e.fail,e.name);result=checkNarrative(e,e.stat,ok,eff);}else if(e.type==='choice'){const ch=e.choices[index];result=resolveChoice(c,e,ch,false);advanceStory(e,ch);}const materialMsg=gatherCampMaterial(state.selectedLocationId);if(materialMsg)result+=(result?'；':'')+materialMsg;const bonusLoot=maybeMultiItemReward(c,'额外发现',.08,3);if(bonusLoot)result+=(result?'；':'')+bonusLoot;state.completedExploreLocations=state.completedExploreLocations||{};state.completedExploreLocations[state.selectedLocationId]=true;const exploreReward=checkAllExploredReward();if(exploreReward)result+=(result?'；':'')+`全岛探索完成奖励：${exploreReward}`;state.eventResolved=true;state.phase='POST';state.currentResult=result||'无事发生';if(c.dead){endGame(false);return;}save();render();
  }
  function resolveChoice(c,e,ch,isNpc){
    if(!ch)return '你站了一会儿，什么也没做。';
    if(ch.risk==='危险'&&c.id===state.playerId)state.statistics.risksTaken++;
    if(ch.action==='none')return '你看了两眼，决定不逞强。今天先把好奇心留到明天。';
    if(ch.action==='effect')return applyEffect(c,ch.effect||{},e.name)||'事情很快过去，没有留下额外影响。';
    if(ch.action==='check'){
      const ok=checkChance(c,ch.stat,ch.difficulty,ch.tags||e.tags||[]);
      if(ok)return checkNarrative(e,ch.stat,true,applyEffect(c,ch.success,e.name));
      const f=ch.fail||{};if(f.chance&&!chance(f.chance))return checkNarrative(e,ch.stat,false,'虽然没成功，好在也没付出额外代价。');
      if(f.beast)return checkNarrative(e,ch.stat,false,beastHazard(c));
      return checkNarrative(e,ch.stat,false,applyEffect(c,f,e.name));
    }
    if(ch.action==='randomFood'){const r=rng();if(r<.6)return `你尝了一点，味道虽然古怪，但没出问题。${gainHealth(c,1)}`;if(r<.85)return '你谨慎地只尝了一小口。等了半天，身体没抗议，也没鼓掌。';healthDamage(c,1);return '几分钟后胃开始翻腾。你健康-1，只能认真反省“看起来能吃”并不是食品认证。';}
    if(ch.action==='gambleFood'){const r=rng();if(r<.55)return `切掉坏的部分后还能入口。${gainHealth(c,1)}`;if(r<.8)return '你勉强咽下去，最后什么也没发生——这大概已经算好消息。';applyDamage(c,1,'食物中毒');return '肚子很快开始抗议。你生命-1，这顿饭的性价比显然不高。';}
    if(ch.action==='mushroom'){const r=rng();if(r<.5)return `运气不错，这种蘑菇没有毒。${gainHealth(c,2)}`;if(r<.8)return '你只尝了一点，既没中毒，也没获得什么神奇力量。';applyDamage(c,1,'误食有毒蘑菇');return '你很快发现判断错了，胸口发闷、胃里翻腾。你生命-1。';}
    return '事情很快过去，没有发生值得记一笔的变化。';
  }

  function enemy(a,b){return relationScore(a,b)<=-50;}
  function makeEnemy(a,b){const cur=relationScore(a,b);if(cur>-50)changeRelation(a,b,-200,'发生严重冲突');else state.relationships[pairKey(a.id,b.id)]=-100;}
  function combatPower(c){let weaponBonus=0;if(has(c,'dagger')||has(c,'spear'))weaponBonus=1;return effectiveStat(c,'str')+effectiveStat(c,'agi')+weaponBonus+(c.id==='zhouye'?2:0);}
  function fight(a,b){
    if(isCouplePair(a,b))return `${a.name}和${b.name}已经是情侣，谁也不会真把争执变成一场打架。`;
    makeEnemy(a,b);a.stats.battles++;b.stats.battles++;if(a.id===state.playerId||b.id===state.playerId)state.statistics.battles++;
    const diff=combatPower(a)-combatPower(b);const p=diff>=3?1:diff===2?.9:diff===1?.7:diff===0?.5:diff===-1?.3:diff===-2?.1:0;
    const winA=chance(p),w=winA?a:b,l=winA?b:a;w.stats.wins++;if(w.id===state.playerId)state.statistics.battleWins++;
    let loot='';const pool=lootableItems(l);if(pool.length){const id=rand(pool);l.inventory.splice(l.inventory.indexOf(id),1);gainItem(w,id,'战利品');loot=`，获得${item(id).name}`;}
    applyDamage(l,1,'与幸存者战斗');return `${w.name}占了上风${loot}；${l.name}生命-1。`;
  }
  function trade(a,b,playerGiveId=null){
    if(enemy(a,b))return `${b.name}现在不愿意和你交易。`;
    const aa=tradableItems(a),bb=tradableItems(b);if(!aa.length)return `${a.name}没有可交易道具。`;if(!bb.length)return `${b.name}没有可交易道具。`;
    let giveA=a.id===state.playerId?playerGiveId:null;if(!giveA||!aa.includes(giveA))giveA=[...aa].sort((x,y)=>NPC.itemValue(item(x),a,state.day)-NPC.itemValue(item(y),a,state.day))[0];
    const sorted=[...new Set(bb)].sort((x,y)=>NPC.itemValue(item(x),b,state.day)-NPC.itemValue(item(y),b,state.day));const rel=relationScore(a,b);let giveB=sorted[0];if(rel>=60)giveB=sorted[sorted.length-1];else if(rel>=25)giveB=sorted[Math.floor((sorted.length-1)*.65)];else if(rel>=0)giveB=sorted[Math.floor((sorted.length-1)*.35)];
    if(!giveA||!giveB)return '没有合适的交换物品。';
    removeInventoryUnit(a,giveA);removeInventoryUnit(b,giveB);gainItem(a,giveB,'交易获得');gainItem(b,giveA,'交易获得');
    const relGain=rel>=25?6:3;a.stats.trades++;b.stats.trades++;const actualRelGain=changeRelation(a,b,relGain,'完成交易');sound('trade');if(a.id===state.playerId||b.id===state.playerId)state.statistics.trades++;
    return `${a.name}拿出${item(giveA).name}-1，${b.name}拿出${item(giveB).name}-1。交换后，${a.name}收到${item(giveB).name}+1，${b.name}收到${item(giveA).name}+1；双方关系提升${Math.abs(actualRelGain)}。`;
  }
  function resolveNpcEncounter(a,b){
    const rel=relationScore(a,b),loc=locationById(a.locationId)?.name||'岛上';let r='';
    if(rel<=-50&&chance(.20)){r=fight(a,b);}
    else if(rel>=25&&chance(.28)&&tradableItems(a).length&&tradableItems(b).length){r=trade(a,b);}
    else{
      const delta=rel>=25?(chance(.65)?3:0):rel<=-20?(chance(.35)?-3:1):(chance(.55)?2:0);
      if(delta)changeRelation(a,b,delta,'短暂交谈');
      r=rel<=-50?'两人保持距离，没有继续冲突。':rel>=25?'两人聊了几句当天的情况。':'两人简单打了个招呼。';
    }
    log(`${a.name}与${b.name}在${loc}碰面：${r}`);
  }
  function processNpcMorningGroups(excludedLocationId){
    const groups={};for(const c of alive().filter(c=>c.id!==state.playerId&&c.locationId!==excludedLocationId)){(groups[c.locationId]||(groups[c.locationId]=[])).push(c);}
    for(const list of Object.values(groups)){shuffle(list);for(let i=0;i+1<list.length;i+=2){if(!list[i].dead&&!list[i+1].dead)resolveNpcEncounter(list[i],list[i+1]);}}
  }
  function locationPeers(){const p=player();return alive().filter(c=>c.id!==p.id&&c.locationId===p.locationId);}
  function targetInteracted(id){return (state.interactedTargetsToday||[]).includes(id);}
  function markInteracted(id){if(!state.interactedTargetsToday)state.interactedTargetsToday=[];if(!state.interactedTargetsToday.includes(id))state.interactedTargetsToday.push(id);}
  function socialActionAvailable(){return !state.socialActionUsedToday;}
  function markSocialAction(id){state.socialActionUsedToday=true;state.socialActionTargetId=id||null;}

  function peerActivity(c,locationId){
    const byRole={
      linlan:['整理随身急救用品','检查手上的小伤口','把能用的布条重新叠好'],
      zhouye:['搬开挡路的木头','检查附近是否有危险落物','把一段松动支架重新固定'],
      chenmo:['摆弄几块零件','检查工具包里的东西','盯着一处结构认真研究'],
      suqing:['观察周围地形','记录今天的光线和云层','站在高处确认远处动静'],
      gaoyuan:['挑拣能吃的东西','整理手边的食物','闻了闻刚找到的植物'],
      xutang:['在笔记本上写着什么','整理这几天的路线记录','给附近做简单标记']
    };
    const byLoc={
      crash_beach:['翻看被海水冲来的残片','沿潮线寻找漂流物'],coconut_grove:['在树下找掉落的果实','避开虫群查看树根附近'],fresh_stream:['在溪边清洗东西','观察水流和岸边脚印'],moon_bay:['沿沙滩慢慢查看潮线','看着海面判断风向'],reef_pools:['蹲在礁池边找鱼和贝类','小心跨过湿滑礁石'],jungle_path:['拨开枝叶查看前路','在树干边辨认痕迹'],bamboo_clearing:['整理公共营地的一角','检查营地设施'],rock_cave:['在洞口观察里面的动静','把干燥位置清理出来'],cliff_edge:['站在安全处观察海平线','查看崖边能否通行'],swamp_edge:['用树枝试探泥地','避开积水寻找较硬的路'],wreck_cabin:['检查机舱残骸的缝隙','从残片里挑出还能用的东西'],ridge_hill:['迎着风观察远海','查看岛上各处的活动痕迹']
    };
    const pool=[...(byRole[c.id]||[]),...(byLoc[locationId]||[])];if(!pool.length)return'正在附近休息';
    return pool[hashSeed(`${state.day}|${c.id}|${locationId}`)%pool.length];
  }
  function makeLocationBrief(locationId,arrival=false){
    const loc=locationById(locationId);if(!loc)return '这里的情况暂时不明。';
    const base=rand(loc.conditions||[loc.desc]);const peers=alive().filter(c=>c.id!==state.playerId&&c.locationId===locationId);
    let extra=peers.length?peers.map(c=>`${c.name}正在${peerActivity(c,locationId)}。`).join(' '):'暂时没有看到其他幸存者。';
    const cr=state.crisisNotice;if(cr&&cr.left<=1)extra+=` ${cr.name}已经很近，今天最好谨慎一点。`;
    if(state.day===1&&!arrival){
      const wake={crash_beach:'你从昏迷中醒来，耳边先是海浪，再是远处金属被风吹动的碰撞声。散落的机身残片提醒你：那架民航客机真的迫降了。',coconut_grove:'你从昏迷中醒来，发现自己倒在潮湿的椰林边。衣服上全是沙和海水，远处还能看到飞机残骸的轮廓。',fresh_stream:'你从昏迷中醒来，脸侧是冰凉的溪水。你记得最后的画面，是客舱在雷暴中剧烈下坠。',moon_bay:'你从昏迷中醒来，细沙沾满手臂。海湾很安静，但远处漂着不属于这座岛的飞机碎片。',reef_pools:'你从昏迷中醒来，身边是退潮后的礁池和被浪冲来的杂物。脑海里还残留着飞机迫降时刺耳的警报声。',jungle_path:'你从昏迷中醒来，发现自己躺在密林边缘。树叶上全是雨水，身后通往海边的方向散落着行李碎片。',bamboo_clearing:'你从昏迷中醒来，四周是一片被风吹乱的林中空地。你不知道自己是怎么被冲到这里的，只记得飞机落海前最后那一下猛烈撞击。',rock_cave:'你从昏迷中醒来，洞口外的海风灌进来。身上的擦伤和湿透的衣服，让你确信这不是梦。',cliff_edge:'你从昏迷中醒来，发现自己离断崖不远。海面上散落着几个黑点，那些可能是飞机残骸。',swamp_edge:'你从昏迷中醒来，脚边是湿软泥地。空气里有浓重的雨后气味，而你只记得飞机被雷暴卷进黑暗。',wreck_cabin:'你从昏迷中醒来，身旁就是扭曲的机舱残骸。几排座椅已经被海水和撞击撕开，周围安静得让人发冷。',ridge_hill:'你从昏迷中醒来，发现自己在岛上较高的位置。远处海面散着飞机残骸，你终于意识到：你可能被困在一座无人岛上。'};
      return `${wake[locationId]||'你从昏迷中醒来，终于意识到飞机迫降后自己被困在一座陌生海岛上。'} ${base} ${extra} 现在最重要的是保持清醒、寻找食物和淡水，设法活到救援到来的那一天。`;
    }
    return `${arrival?'你来到':'清晨，你仍在'}${loc.name}。${base} ${extra}`;
  }
  function triggerHostileLocationBattle(){
    const p=player(),key=`${state.day}|${p.locationId}`;if(state.hostileCheckedKey===key)return false;state.hostileCheckedKey=key;
    const hostiles=locationPeers().filter(o=>enemy(p,o));if(!hostiles.length||!chance(Number(rules().hostileBattleChance??.20)))return false;
    const o=rand(hostiles),result=fight(p,o);state.hostileIncident={targetId:o.id,result};state.phase='POST_ACTION';state.currentResult=`你刚在${locationById(p.locationId)?.name||'这里'}站稳，${o.name}就和你发生了冲突。${result}`;log(`敌对相遇：你与${o.name}发生战斗。`);sound('battle');if(p.dead){endGame(false);return true;}return true;
  }
  function setLocationPhase(arrival=false){state.locationBrief=makeLocationBrief(player().locationId,arrival);state.phase='LOCATION';state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.interaction=null;const hostile=triggerHostileLocationBattle();save();render();if(arrival&&!hostile){const peers=locationPeers().filter(c=>!targetInteracted(c.id));if(peers.length&&chance(.30)){const o=rand(peers);setTimeout(()=>{if(state&&state.phase==='LOCATION'&&player().locationId===o.locationId&&!targetInteracted(o.id)){toast(`${o.name}主动走过来和你说话`);beginInteraction(o.id);}},650);}}}
  function relationBucket(a,b){const s=relationScore(a,b),bond=Number(rules().bondThreshold||60);if(s<=-50)return'enemy';if(s<=-20)return'cold';if(s<25)return'normal';if(s<bond)return'trust';return'bond';}
  function buildInteractionScene(o){
    const p=player(),prof=D.interactionProfiles?.[o.id],bucket=relationBucket(p,o),loc=p.locationId,rel=relationScore(p,o);
    const recent=state.recentInteractionEvents||(state.recentInteractionEvents=[]),recentLimit=Math.max(6,Number(rules().interactionRecentWindow||24));
    if(isCouplePair(p,o)&&D.coupleInteractionEvents?.length){
      const rc=state.recentCoupleEvents||(state.recentCoupleEvents=[]);
      let cp=D.coupleInteractionEvents.filter(e=>!rc.includes(e.id));if(!cp.length){rc.length=0;cp=[...D.coupleInteractionEvents];}
      if(chance(.72)){const e=rand(cp);rc.push(e.id);if(rc.length>5)rc.shift();return {id:e.id,title:`❤ ${e.name}`,text:String(e.text||'').split('{name}').join(o.name).split('{place}').join(locationById(loc)?.name||'这里'),choices:e.choices||[],couple:true};}
    }
    let extras=(D.interactionEvents||[]).filter(e=>(e.minRelation==null||rel>=e.minRelation)&&(e.maxRelation==null||rel<=e.maxRelation)&&(!e.locations||e.locations.includes(loc))&&(!e.roles||e.roles.includes(o.id))&&!recent.includes(e.id));
    if(!extras.length)extras=(D.interactionEvents||[]).filter(e=>(e.minRelation==null||rel>=e.minRelation)&&(e.maxRelation==null||rel<=e.maxRelation)&&(!e.locations||e.locations.includes(loc))&&(!e.roles||e.roles.includes(o.id)));
    const personalId=`profile_${o.id}_${bucket}_${loc}`;
    shuffle(extras);if(extras.length>32)extras=extras.slice(0,32);
    const useExtra=extras.length&&(recent.includes(personalId)||chance(.84));
    if(useExtra){const e=rand(extras);recent.push(e.id);if(recent.length>recentLimit)recent.shift();return {id:e.id,title:e.name,text:String(e.text||'').split('{name}').join(o.name).split('{place}').join(locationById(loc)?.name||'这里'),choices:e.choices||[]};}
    const base=prof?.lines?.[bucket]||`${o.name}看了你一眼。`;
    const local=prof?.location?.[loc]||`你们在${locationById(loc)?.name||'这里'}碰面。`;
    recent.push(personalId);if(recent.length>recentLimit)recent.shift();
    return {id:personalId,title:'简单交谈',text:`${local}
${base}`,choices:prof?.choices||[]};
  }
  function firstMeetingDialogue(o){
    const p=player(),loc=locationById(p.locationId)?.name||'这里';
    const greet={
      linlan:`“你醒着就好。我叫${o.name}，急诊护士。先别逞强，头晕、恶心、胸痛都要告诉我。”`,
      zhouye:`“我叫${o.name}，消防员。能走吗？先确认人没事，再想办法活下去。”`,
      chenmo:`“${o.name}，机械工程师。飞机的情况很糟，不过还能拆出不少能用的东西。”`,
      suqing:`“我叫${o.name}，做户外摄影。放心，我现在没心情拍你狼狈的样子——先活下来再说。”`,
      gaoyuan:`“${o.name}，厨师。先声明，我会做饭，但这里没有冰箱、盐和菜单，条件比较苛刻。”`,
      xutang:`“我叫${o.name}，中学老师。先别慌，我们把能做的事一件件列出来，至少会比乱跑强。”`
    }[o.id]||`“我叫${o.name}。看来我们都被冲到这座岛上了。”`;
    return [
      {who:o.id,text:greet},
      {who:p.id,text:`“我叫${p.name}。刚醒过来脑子还有点乱……但总算见到活人了。”`},
      {who:o.id,text:`“这里是${loc}。附近还有其他幸存者的话，我们最好尽快确认。一个人硬撑可不是什么英雄行为。”`},
      {who:p.id,text:'“好。先活下来，再慢慢搞清楚这座岛到底是什么情况。”'}
    ];
  }

  function interactionDialogue(o,scene){
    const p=player(),bucket=relationBucket(p,o),prof=D.interactionProfiles?.[o.id],loc=locationById(p.locationId)?.name||'这里';
    const playerOpen={enemy:'“我知道我们现在很难好好说话，但这件事最好先说清楚。”',cold:'“先别急着走。我想听听你真正怎么想。”',normal:'“你说吧，我在听。也许我们能一起想个办法。”',trust:'“不用绕弯子。有什么事就直说，我们已经一起撑了这么多天。”',bond:'“别一个人扛着。你说，我在。”'}[bucket]||'“你继续说。”';
    const roleReply=prof?.lines?.[bucket]||`${o.name}看了看你，语气慢慢放松下来。`;
    const roleDeep={linlan:'“我习惯先看别人有没有事。可这里没有护士站，也没有交班表，有时候我也只能硬着头皮猜。”',zhouye:'“我不怕危险，我怕判断错了把别人也拖进去。消防员培训里可没教过怎么给椰子树做风险预案。”',chenmo:'“很多问题其实能算清楚，但人不是零件。零件坏了还能换，人闹别扭就复杂多了。”',suqing:'“以前我总觉得下一张照片会更好。现在反而觉得，能把今天记住就不错——何况我的相机还挺命硬。”',gaoyuan:'“人饿的时候脾气会变，累的时候也是。现在我最大的职业危机，是连一撮盐都得靠运气。”',xutang:'“我以前总告诉学生，遇到问题先别慌。轮到自己才知道，这句话写在黑板上比做起来容易多了。”'}[o.id]||'“说实话，我也没想好。但至少现在有人能商量。”';
    const playerReply={enemy:'“我不想再把事情弄得更糟。至少今天，我们先别互相添麻烦。”',cold:'“我不要求你马上相信我，但我们可以先把这一件事处理好。”',normal:'“我明白。先把眼前的问题解决，剩下的以后再说。”',trust:'“你需要我做什么就说，我们一起处理。”',bond:'“我们都走到这里了，这次也一起扛过去。”'}[bucket]||'“我们慢慢想。”';
    const roleClose={enemy:'“我会记住你今天说的话。别让我后悔。”',cold:'“行，先这样。至少比什么都不说强。”',normal:'“好。那就照这个思路试试。”',trust:'“有你这句话，我心里踏实一点。”',bond:'“那就说好了。明天还在的话，我们再一起想下一步。”'}[bucket]||'“嗯，先这么办。”';
    return [
      {who:o.id,text:scene.text||`${o.name}在${loc}主动提起今天的情况。`},
      {who:p.id,text:playerOpen},
      {who:o.id,text:roleReply},
      {who:o.id,text:roleDeep},
      {who:p.id,text:playerReply},
      {who:o.id,text:roleClose}
    ];
  }
  function beginInteraction(targetId,opts={}){
    if(playerForcedRestToday()){toast('今天只能休整，聊天也先欠着');return;}
    const travel=!!opts.travel;if(!travel&&!['LOCATION','POST','POST_ACTION'].includes(state.phase))return;
    if(targetInteracted(targetId)){toast('今天已经与这个人物互动过一次');return;}
    const p=player(),o=cBy(targetId);if(!o||o.dead||(!travel&&o.locationId!==p.locationId))return;
    state.locationLockedToday=true;const cache=state.interactionScenesToday||(state.interactionScenesToday={});let scene;const firstMeet=!state.firstMeetings?.[o.id];
    if(travel){scene=buildInteractionScene(o);scene={...scene,id:`travel_${scene.id}_${o.id}`,title:`途中相遇 · ${scene.title}`,text:`你在前往${locationById(p.locationId)?.name||'目的地'}的路上碰见了${o.name}。${scene.text}`,dialogue:null};scene.dialogue=firstMeet?firstMeetingDialogue(o):interactionDialogue(o,scene);}
    else{if(!cache[targetId]){cache[targetId]=buildInteractionScene(o);cache[targetId].dialogue=firstMeet?firstMeetingDialogue(o):interactionDialogue(o,cache[targetId]);}else if(!cache[targetId].dialogue)cache[targetId].dialogue=firstMeet?firstMeetingDialogue(o):interactionDialogue(o,cache[targetId]);scene=cache[targetId];}
    if(firstMeet){state.firstMeetings=state.firstMeetings||{};state.firstMeetings[o.id]=state.day;log(`你首次遇见了${o.name}（${o.job}）。`,true);}
    state.interaction={targetId,scene,travel,dialogueIndex:0};state.phase='INTERACTION';sound('encounter');save();render();
  }
  function advanceInteractionDialogue(){
    const it=state.interaction;if(!it)return;const o=cBy(it.targetId),rows=it.scene?.dialogue||interactionDialogue(o,it.scene||{});it.scene.dialogue=rows;it.dialogueIndex=Math.min(rows.length,(it.dialogueIndex||0)+1);sound('click');save();render();
  }
  function interactionChoice(index){
    const it=state.interaction,p=player(),o=cBy(it?.targetId),ch=it?.scene?.choices?.[index];if(!it||!o||!ch||it.storyResolved)return;
    let result='',before=relationScore(p,o);
    if(ch.kind==='check'){
      const ok=checkChance(p,ch.stat,ch.difficulty||'normal',ch.tags||[]),delta=ok?(ch.goodRelation||0):(ch.badRelation||0);if(delta)changeRelation(p,o,delta,ok?'一起把事情办成了':'这次配合没那么顺');
      const eff=ok?applyEffect(p,ch.reward||{},'人物互动'):'';result=ok?`${o.name}听完你的想法，点了点头。你们把这件事一起做成了。${eff}`:`你们试了一会儿，却总差一点默契。${o.name}叹了口气：“行，至少知道这办法不太行。”`;
    }else{const delta=ch.relation||0;if(delta)changeRelation(p,o,delta,'这次交谈');const eff=applyEffect(p,ch.reward||{},'人物互动');result=`你选择“${ch.text}”。${o.name}认真听完，回应得比刚才放松了一些。${eff}`;}
    const after=relationScore(p,o),diff=after-before;if(diff){const tone=Math.abs(diff)>10?'，彼此的态度明显变了':'，彼此的态度有所改变';result+=`；${o.name}跟你的关系${diff>0?'提升':'下降'}${Math.abs(diff)}${tone}`;}
    const interactionLoot=maybeMultiItemReward(p,'互动中意外发现',.05,2);if(interactionLoot)result+=(result?'；':'')+interactionLoot;
    markInteracted(o.id);it.storyResolved=true;it.storyResult=result||'你们聊了几句，至少比互相瞪着省力。';state.currentResult=it.storyResult;log(`你与${o.name}在${locationById(p.locationId)?.name||'岛上'}完成了今天的人物互动。`);save();render();
  }
  function finishInteraction(){
    const it=state.interaction;if(!it)return;state.interaction=null;state.currentResult='';state.phase='LOCATION';save();render();
  }
  function interactionTradeModal(){
    const p=player(),o=cBy(state.interaction?.targetId);if(!o)return;if(!state.interaction?.storyResolved){toast('先把这次对话聊完');return;}if(!socialActionAvailable()){toast('今天已经进行过一次交易、赠送或抢夺');return;}
    if(enemy(p,o)){toast(`${o.name}与你处于敌对状态，不愿交易`);return;}
    const mine=tradableItems(p),theirs=tradableItems(o);if(!mine.length){toast('你没有可交易的道具');return;}if(!theirs.length){toast(`${o.name}没有可交易的道具`);return;}
    modal(`<h2>与${esc(o.name)}交易</h2><p class="muted">你只能选择自己拿出的道具。对方会自己决定拿什么交换，专属初始道具永远不能交易。</p>${[...new Set(mine)].map(id=>`<button class="choice" onclick="Game.interactionTradeChoose('${id}')">拿出 ${item(id).ico} <b class="itemName">${esc(item(id).name)}</b></button>`).join('')}<button class="btn ghost" onclick="Game.closeModal()">取消</button>`);
  }
  function interactionTradeChoose(id){
    closeModal();const p=player(),o=cBy(state.interaction?.targetId);if(!o||!socialActionAvailable())return;const result=trade(p,o,id);markSocialAction(o.id);state.currentResult=result;state.interaction=null;state.phase='POST_ACTION';log(`你与${o.name}进行了交易。`);save();render();
  }
  function interactionGiftModal(){
    const p=player(),o=cBy(state.interaction?.targetId);if(!o)return;if(!state.interaction?.storyResolved){toast('先把这次对话聊完');return;}if(!socialActionAvailable()){toast('今天已经进行过一次交易、赠送或抢夺');return;}const mine=tradableItems(p);if(!mine.length){toast('你没有可以赠送的普通道具');return;}
    modal(`<h2>赠送给 ${esc(o.name)}</h2><p class="muted">赠送不会换回物品，但会明显改善关系。</p>${[...new Set(mine)].map(id=>`<button class="choice" onclick="Game.interactionGiftChoose('${id}')">赠送 ${item(id).ico} <b class="itemName">${esc(item(id).name)}</b></button>`).join('')}<button class="btn ghost" onclick="Game.closeModal()">取消</button>`);
  }
  function interactionGiftChoose(id){
    closeModal();const p=player(),o=cBy(state.interaction?.targetId);if(!o||!socialActionAvailable()||!tradableItems(p).includes(id))return;removeInventoryUnit(p,id);gainItem(o,id,'收到赠送');const boost=relationScore(p,o)<0?16:12,actualBoost=changeRelation(p,o,boost,'收到你的赠送');markSocialAction(o.id);state.currentResult=`你把${item(id).name}+1递给${o.name}。${o.name}愣了一下，认真收好。${o.name}跟你的关系提升${Math.abs(actualBoost)}，彼此的态度${Math.abs(actualBoost)>10?'明显变了':'有所改变'}。`;state.interaction=null;state.phase='POST_ACTION';log(`你赠送给${o.name}${item(id).name}。`);sound('good');save();render();
  }
  function downgradeOneTierWithPlayer(other,reason='抢夺行为'){const p=player();if(!other||other.id===p.id||other.dead)return;const beforeLabel=isCouplePair(p,other)?'情侣':relationTierByScore(relationScore(p,other)).label;let target;const score=relationScore(p,other);if(beforeLabel==='情侣'){state.coupleId=null;state.coupleHome=null;target=40;}else if(score>=Number(rules().bondThreshold||60))target=40;else if(score>=25)target=0;else if(score>-20)target=-30;else target=-70;const before=relationScore(p,other);state.relationships[pairKey(p.id,other.id)]=target;const afterLabel=relationTierByScore(target).label;if(beforeLabel!==afterLabel){queueRelationAlert(other,beforeLabel,afterLabel,reason,'');log(`${other.name}与你的关系：${beforeLabel} → ${afterLabel}（${reason}）`,true);}}
  function interactionRob(){
    const p=player(),o=cBy(state.interaction?.targetId);if(!o)return;if(!state.interaction?.storyResolved){toast('先把这次对话聊完');return;}if(!socialActionAvailable()){toast('今天已经进行过一次交易、赠送或抢夺');return;}if(isCouplePair(p,o)){toast('情侣之间不能抢夺或攻击');return;}const pool=lootableItems(o);if(!pool.length){toast(`${o.name}没有可以抢夺的道具`);return;}
    makeEnemy(p,o);for(const other of alive().filter(c=>c.id!==p.id&&c.id!==o.id))downgradeOneTierWithPlayer(other,'你主动抢夺了其他幸存者');
    let result;if(chance(.30)){result=`你突然伸手想抢${o.name}的背包，但${o.name}反应很快，带着东西退开并逃走了。你什么也没抢到。`;}else{result=`抢夺立刻演变成冲突。${fight(p,o)}`;}result+=` ${o.name}跟你的关系直接变为敌对；其他幸存者也因为这件事对你更冷淡了一档。`;
    markSocialAction(o.id);state.currentResult=result;state.interaction=null;state.phase='POST_ACTION';log(`你试图抢夺${o.name}的物资，双方关系变为敌对。`);sound('battle');if(p.dead){endGame(false);return;}save();render();
  }
  function cancelInteraction(){state.interaction=null;state.phase='LOCATION';save();render();}
  function restAtLocation(){
    if(!['LOCATION','POST','POST_ACTION'].includes(state.phase))return;if(state.exploredToday){toast('今天已经完成探索，不能再用探索时段休整');return;}const p=player();state.exploredToday=true;state.locationLockedToday=true;p.skipDecay=true;let result='你把今天的探索时段改为休整。今晚不会因日常消耗下降健康。';
    if(gearMod(p,'restBonus')){const ht=gainHealth(p,1);p.nextCheckBonus=Math.max(p.nextCheckBonus,.05);result+=` 轻便吊床让你休息得更好，${ht}。`;}
    state.currentResult=result;state.phase='POST_ACTION';log(`你在${locationById(p.locationId)?.name||'当前地点'}休整。`);save();render();
  }

  function checkAllExploredReward(){
    if(state.allExploredRewarded||Object.keys(state.completedExploreLocations||{}).length<D.locations.length)return null;
    state.allExploredRewarded=true;const p=player();const rewards=[
      ()=>{const id=highItem();gainItem(p,id,'全岛探索奖励');return `获得稀有道具${item(id).name}`;},
      ()=>{const n=addLife(p,1);return n?`生命+${n}`:'生命已满，获得求救努力+2';},
      ()=>{state.rescueScore+=2;return '求救努力+2';},
      ()=>{camp().materials.wood+=2;camp().materials.fiber+=2;camp().materials.scrap+=1;return '获得木材×2、藤条×2、零件×1';},
      ()=>{const gains=alive().filter(x=>x.id!==p.id).map(o=>changeRelation(p,o,5,'完成全岛探索')).filter(Boolean);return `与所有幸存者关系+${gains.length?Math.max(...gains.map(Math.abs)):Math.abs(scaledRelationDelta(5))}`;},
      ()=>{p.nextCheckBonus=Math.max(p.nextCheckBonus,.20);return '下一次属性检定获得大幅加成';}
    ];
    let idx=Math.floor(rng()*rewards.length);if(idx===1&&p.life>=p.maxLife){state.rescueScore+=2;idx=2;}const text=rewards[idx]();checkShelterBuildReady();state.exploreRewardText=text;log(`全岛探索奖励：探索完全部12个地点：${text}`);sound('story');toast(`★ 全岛探索完成：${text}`);return text;
  }
  function chooseTravelEvent(){
    const recent=state.recentTravelEvents||(state.recentTravelEvents=[]);let pool=(D.travelEvents||[]).filter(e=>!recent.includes(e.id));if(!pool.length){recent.length=0;pool=[...(D.travelEvents||[])];}const e=rand(pool);recent.push(e.id);if(recent.length>8)recent.shift();return e;
  }
  function startTravelEvent(fromId,toId){
    state.travelContext={fromId,toId};state.travelEvent=chooseTravelEvent();state.travelEventResult='';state.phase='TRAVEL';const e=state.travelEvent,p=player();
    if(e.type==='instant'){state.travelEventResult=applyEffect(p,e.effect||{},e.name)||'事情很快过去了。';if(p.dead){endGame(false);return;}state.phase='TRAVEL';save();render();return;}
    if(e.type==='check'){const ok=checkChance(p,e.stat,e.difficulty||'normal',e.tags||[]),eff=applyEffect(p,ok?(e.success||{}):(e.fail||{}),e.name);state.travelEventResult=checkNarrative(e,e.stat,ok,eff);if(p.dead){endGame(false);return;}state.phase='TRAVEL';save();render();return;}
    state.phase='TRAVEL';save();render();
  }
  function resolveTravelChoice(index){
    const e=state.travelEvent,p=player(),ch=e?.choices?.[index];if(!e||!ch||state.travelEventResult)return;state.travelEventResult=resolveChoice(p,e,ch,false)||'事情很快过去了。';if(p.dead){endGame(false);return;}save();render();
  }
  function finishTravelArrival(){
    state.travelEvent=null;state.travelEventResult='';const p=player();
    const candidates=alive().filter(c=>c.id!==p.id&&!targetInteracted(c.id));
    if(candidates.length&&chance(.35)){const o=rand(candidates);toast(`途中遇见了${o.name}`);beginInteraction(o.id,{travel:true});return;}
    setLocationPhase(true);
  }

  function moveToLocation(locationId){
    if(state.phase!=='MAP'||state.travelDecisionMade)return;const loc=locationById(locationId);if(!loc)return;const p=player(),fromId=p.locationId;
    state.travelDecisionMade=true;state.locationLockedToday=true;
    if(p.locationId!==locationId){const first=!state.exploredLocations[locationId];p.locationId=locationId;state.movedToday=true;state.exploredLocations[locationId]=true;state.locationBrief=makeLocationBrief(locationId,true);if(first&&p.id==='suqing'&&chance(.35)){const found=randomItem();gainItem(p,found,'自然感知');log(`苏晴首次抵达${loc.name}，凭观察发现了${item(found).name}。`);}log(`你从${locationById(fromId)?.name||'原地'}出发，前往${loc.name}。`);sound('move');if(chance(.30)){startTravelEvent(fromId,locationId);return;}finishTravelArrival();}
    else{setLocationPhase(false);}
  }

  function openMap(){
    if(playerForcedRestToday()){toast('今天太疲惫了，别折腾地图了，休息吧');return;}
    if(state.travelDecisionMade){toast('今天已经决定了停留地点');return;}
    if(!['MORNING','MAP'].includes(state.phase))return;state.phase='MAP';save();render();
  }
  function chooseStay(){if(state.phase!=='MORNING'||state.travelDecisionMade)return;state.travelDecisionMade=true;state.locationLockedToday=true;log(`你决定今天留在${locationById(player().locationId)?.name||'当前地点'}。`);setLocationPhase(false);}

  function morningRelationshipSupport(){
    const p=player();const friends=alive().filter(c=>c.id!==p.id&&c.locationId===p.locationId&&relationScore(p,c)>=35).sort((a,b)=>relationScore(p,b)-relationScore(p,a));if(!friends.length)return;
    const f=friends[0];if(p.health<=1&&chance(.22)){const food=tradableItems(f).find(id=>item(id).kind==='food');if(food){f.inventory.splice(f.inventory.indexOf(food),1);addHealth(p,1);changeRelation(p,f,3,'互相照顾');log(`${f.name}清晨分给你一点食物。`);}}
  }
  function prepareDailyActionOrder(){
    const ids=shuffle(alive().map(c=>c.id));state.dailyActionOrder=ids;state.npcActedToday=[];
    const pIndex=Math.max(0,ids.indexOf(state.playerId));
    for(const id of ids.slice(0,pIndex)){const c=cBy(id);if(c&&!c.dead){npcTurn(c);state.npcActedToday.push(id);}}
    log(`今天的行动顺序：${ids.map(id=>cBy(id)?.name||id).join(' → ')}。`);
  }
  function runRemainingNpcTurns(){
    const acted=new Set(state.npcActedToday||[]);for(const id of state.dailyActionOrder||[]){if(id===state.playerId||acted.has(id))continue;const c=cBy(id);if(c&&!c.dead){npcTurn(c);acted.add(id);}}
    state.npcActedToday=[...acted];
  }
  function startDay(showFx=true){
    const p=player();
    state.characters.forEach(c=>{if(c.abilityCooldown>0)c.abilityCooldown--;if(!c.dead&&c.id==='linlan'&&c.life<c.maxLife&&c.abilityCooldown<=0&&chance(.60)){addLife(c,1);c.abilityCooldown=3;log(`${c.name}的急救专家触发，生命+1`);if(c.id===state.playerId)toast('急救专家：生命+1');}if(!c.dead)c.dayStartHealth=c.health;});
    state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.travelEvent=null;state.travelContext=null;state.travelEventResult='';state.travelInteractionPending=false;state.nightDanger=0;state.selectedLocationId=null;state.movedToday=false;state.exploredToday=false;state.interactedTargetsToday=[];state.socialActionUsedToday=false;state.socialActionTargetId=null;state.interactionScenesToday={};state.travelDecisionMade=false;state.locationLockedToday=false;state.interaction=null;state.lastIntimateEvent=null;state.animalInteractedToday=[];state.animalInteraction=null;spawnDailyAnimals();
    campProduction();updateCrisisNotice();prepareDailyActionOrder();morningRelationshipSupport();processNpcMorningGroups(p.locationId);state.locationBrief=makeLocationBrief(p.locationId,false);state.phase='MORNING';checkShelterBuildReady();save();render();if(showFx)setTimeout(showDayTransition,40);
  }
  function npcUseNeeds(c){if(c.dead)return;if(c.life<c.maxLife){const heal=c.inventory.find(id=>['first_aid','bandage','apple'].includes(id));if(heal)useNpcItem(c,heal);}if(NPC.shouldUseFood(c)){const food=c.inventory.find(id=>item(id).kind==='food'&&(item(id).effect?.health||item(id).effect?.wildFood));if(food)useNpcItem(c,food);}}
  function useNpcItem(c,id){const it=item(id),idx=c.inventory.indexOf(id);if(idx<0||!it.consumable)return;if(it.effect?.health)addHealth(c,it.effect.health);if(it.effect?.life){addLife(c,it.effect.life);if(c.id==='linlan'&&it.kind==='medical')addLife(c,1);}if(it.effect?.skipDecay)c.skipDecay=true;if(it.effect?.shield)c.damageShield++;if(it.effect?.generalShield)c.generalShield++;if(it.effect?.nextCheckBonus)c.nextCheckBonus=Math.max(c.nextCheckBonus,it.effect.nextCheckBonus);if(it.effect?.wildFood){if(chance(.75))addHealth(c,1);else healthDamage(c,1);}let consume=true;if(c.id==='gaoyuan'&&it.kind==='food'){if(it.effect?.health)gainHealth(c,1);if(chance(.60))consume=false;}if(consume)c.inventory.splice(idx,1);}
  function chooseNpcDestination(c){
    const ai=Number(c.aiLevel||3),own=homeShelterOf(c),hasFood=c.inventory.some(id=>item(id)?.kind==='food'),p=player();
    if(c.exhaustedDay===state.day)return c.locationId;
    const crisis=crisisToday();
    if(crisis&&chance(.88)){if(own.level)return own.locationId;return camp().locationId;}
    const homeProb={linlan:.34,zhouye:.28,chenmo:.38,suqing:.25,gaoyuan:.32,xutang:.40}[c.id]||.30;
    if(state.day>=20&&own.level&&chance(homeProb))return own.locationId;
    let best=c.locationId,bestScore=-999;
    for(const loc of D.locations){
      let score=loc.id===c.locationId?1.2:0;
      if(c.health<=1){if(loc.id==='fresh_stream')score+=7;if(loc.id===camp().locationId&&(camp().storedFood>0||camp().storedWater>0))score+=10;if(own.level&&loc.id===own.locationId)score+=6;}if(!hasFood&&camp().storedFood>0&&loc.id===camp().locationId)score+=7;
      if(c.life<=2){if(loc.id==='wreck_cabin'||loc.id==='crash_beach')score+=3;if(own.level&&loc.id===own.locationId)score+=4;}
      if(!hasFood&&['coconut_grove','moon_bay','reef_pools','fresh_stream'].includes(loc.id))score+=4;
      if(own.level&&state.day%4===0&&loc.id===own.locationId)score+=2;
      if(relationScore(c,p)>=25&&loc.id===p.locationId)score+=1.5;
      if(c.health<=1&&['swamp_edge','cliff_edge'].includes(loc.id))score-=4;
      if(!c.aiExplored?.[loc.id])score+=1.3;
      score += rng()*(7-ai);
      if(score>bestScore){bestScore=score;best=loc.id;}
    }
    return best;
  }
  function npcRepairCamp(c){
    if(c.dead||c.locationId!==camp().locationId)return false;const damaged=Object.keys(camp().damagedBuildings||{}).filter(id=>camp().damagedBuildings[id]);if(!damaged.length)return false;const ai=Number(c.aiLevel||3);if(!chance(.012*ai))return false;const id=damaged[0],b=(D.campBuildings||[]).find(x=>x.id===id);if(!b)return false;const cost=effectiveCost(c,halfCost(b.cost));if(!canAffordMaterials(cost))return false;payMaterials(cost);delete camp().damagedBuildings[id];log(`${c.name}修复了公共营地的${b.name}。`);return true;
  }
  function npcTurn(c){
    if(c.dead)return;if(c.exhaustedDay===state.day){c.skipDecay=true;npcUseNeeds(c);npcUseCampSupplies(c);log(`${c.name}今天明显有些疲倦，干脆留在原地休整。`);return;}npcUseNeeds(c);c.locationId=chooseNpcDestination(c);c.aiExplored=c.aiExplored||{};c.aiExplored[c.locationId]=true;npcUseCampSupplies(c);npcRepairCamp(c);
    const e=chooseLocationEvent(c.locationId,true);if(e.type==='instant')applyEffect(c,e.effect,e.name);else if(e.type==='hazard'){if(e.hazard==='beast')beastHazard(c);else rainHazard(c);}else if(e.type==='check'){const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]);applyEffect(c,ok?e.success:e.fail,e.name);}else if(e.type==='choice'){const ix=NPC.eventChoice(c,e,D,rng);resolveChoice(c,e,e.choices[ix],true);}npcUseNeeds(c);npcUseCampSupplies(c);npcShelterDecision(c);
  }


  function nightInteractionProbability(a,b){
    const rel=relationScore(a,b),closeness=clamp((rel+100)/200,0,1);
    return clamp(.40+closeness*.40,.40,.80);
  }
  function runCoupleIntimateNight(){
    const p=player(),o=state.coupleId?cBy(state.coupleId):null;if(!p||!o||p.dead||o.dead)return null;
    if(p.locationId!==o.locationId)return null;const shared=state.coupleHome?.locationId,atHome=shared&&p.locationId===shared,atCamp=p.locationId===camp().locationId;if(!atHome&&!atCamp)return null;
    if(!chance(.85))return null;
    const tpl=rand(D.intimateCoupleEvents||[]);if(!tpl)return null;
    p.health=3;o.health=3;const female=p.sex==='女'?p:o,male=p.sex==='男'?p:o;female.tempBuffDay=state.day+1;male.exhaustedDay=state.day+1;changeRelation(p,o,4,'夜里彼此陪伴');
    const replace=s=>String(s||'').replaceAll('{a}',p.name).replaceAll('{b}',o.name);const dialogue=(tpl.dialogue||[]).map(replace);const text=`${replace(tpl.text)} ${dialogue.join(' ')}`;
    const out={id:tpl.id,title:tpl.title,text,locationId:p.locationId,a:p.id,b:o.id};state.lastIntimateEvent=out;log(`情侣夜间剧情：${tpl.title}。`);return out;
  }
  function runNightInteractions(skipPair=''){
    const groups={};for(const c of alive())(groups[c.locationId]||(groups[c.locationId]=[])).push(c);
    const notes=[];state.nightInteractionLog=[];
    for(const [locId,list] of Object.entries(groups)){
      if(list.length<2)continue;
      const pairs=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)pairs.push([list[i],list[j]]);
      shuffle(pairs);let shown=0;
      for(const [a,b] of pairs){
        if(pairKey(a.id,b.id)===skipPair)continue;if(shown>=2)break;const prob=nightInteractionProbability(a,b);if(!chance(prob))continue;
        const rel=relationScore(a,b),normalized=clamp((rel+100)/200,0,1),positiveP=clamp(.42+normalized*.50,.42,.92),positive=chance(positiveP),tpl=rand(D.nightInteractionEvents||[{id:'night_chat',text:'{a}和{b}在夜里聊了几句。',positive:'气氛不错。',negative:'气氛有些僵。'}]);
        let text=tpl.text.replaceAll('{a}',a.name).replaceAll('{b}',b.name),effect='';
        if(positive){const delta=Math.round(2+normalized*4);changeRelation(a,b,delta,'夜间相处');effect=tpl.positive;if(a.id===state.playerId||b.id===state.playerId){const p=a.id===state.playerId?a:b;if(normalized>.7&&chance(.28)){p.nextCheckBonus=Math.max(p.nextCheckBonus,.08);effect+=' 你明天会更有底气。';}}}
        else{const delta=-Math.max(1,Math.round(4-normalized*2));changeRelation(a,b,delta,'夜间摩擦');effect=tpl.negative;}
        const loc=locationById(locId)?.name||'同一地点';const line=`${loc}：${text}${effect}`;notes.push(line);state.nightInteractionLog.push({a:a.id,b:b.id,locationId:locId,positive,text:line});shown++;
      }
    }
    return notes;
  }
  function runNight(){
    let trigger=(Number(rules().nightEventChance)||.70)+state.nightDanger;if(has(player(),'flashlight'))trigger-=.15;trigger=clamp(trigger,.15,.90);if(!chance(trigger))return {title:'今夜平静',text:'风从树林里穿过去。没有发生特别的事。',locationId:null};
    const eligible=D.nights.filter(n=>!n.minDay||state.day>=n.minDay);const n=rand(eligible);const ef=n.effect,living=alive();const occupied=[...new Set(living.map(c=>c.locationId))];const targetLocationId=n.scope==='location'&&occupied.length?rand(occupied):null;const affected=targetLocationId?living.filter(c=>c.locationId===targetLocationId):living;let extra=[];
    if(ef.allHazard==='rain')affected.forEach(c=>extra.push(`${c.name}：${rainHazard(c)}`));if(ef.randomHazard==='beast'&&affected.length){const c=rand(affected);extra.push(`${c.name}：${beastHazard(c)}`);}if(ef.weakHealth)affected.filter(c=>c.health<=1).forEach(c=>{healthDamage(c,1);extra.push(`${c.name}健康-1`);});if(ef.randomLoseItem&&affected.length){const c=rand(affected),id=loseRandomItem(c);if(id)extra.push(`${c.name}失去${item(id).name}`);}if(ef.randomHealthDamage)affected.forEach(c=>{if(chance(ef.randomHealthDamage)){healthDamage(c,1);extra.push(`${c.name}健康-1`);}});if(ef.randomHealth&&affected.length){const pool=n.id==='insects'?affected.filter(c=>!gearMod(c,'insectSafe')):affected;if(pool.length){const c=rand(pool);if(ef.randomHealth>0)addHealth(c,ef.randomHealth);else healthDamage(c,-ef.randomHealth);extra.push(`${c.name}健康${ef.randomHealth>0?'+':''}${ef.randomHealth}`);}}if(ef.lowestHealth&&affected.length){const min=Math.min(...affected.map(c=>c.health));const c=rand(affected.filter(x=>x.health===min));addHealth(c,ef.lowestHealth);extra.push(`${c.name}健康+1`);}if(ef.allChanceHealth)affected.forEach(c=>{if(chance(ef.allChanceHealth)){healthDamage(c,1);extra.push(`${c.name}健康-1`);}});if(ef.randomItem&&affected.length){const c=rand(affected),id=randomItem();gainItem(c,id);extra.push(`${c.name}获得${item(id).name}`);}if(ef.nextCheckBonus)affected.forEach(c=>c.nextCheckBonus=Math.max(c.nextCheckBonus,ef.nextCheckBonus));if(ef.protectWeak)affected.filter(c=>c.health<=1).forEach(c=>c.skipDecay=true);if(ef.rescueScore)state.rescueScore+=ef.rescueScore;if(ef.relationDown&&affected.length>=2){const [a,b]=shuffle([...affected]).slice(0,2);changeRelation(a,b,-10,'夜间争吵');extra.push(`${a.name}和${b.name}之间的气氛变差了`);}if(ef.theft&&affected.length>=2&&chance(.28)){const [a,b]=shuffle([...affected]).slice(0,2),pool=lootableItems(b);if(pool.length&&invUsedSlots(a)<invLimit(a)){const id=rand(pool);removeInventoryUnit(b,id);gainItem(a,id,'夜间取得');changeRelation(a,b,-20,'夜间失窃');extra.push(`${a.name}拿走了${b.name}的${item(id).name}`);}}
    const locName=targetLocationId?locationById(targetLocationId)?.name:null;return {title:locName?`${locName} · ${n.name}`:n.name,text:n.text+(extra.length?'\n'+extra.join('；'):''),locationId:targetLocationId};
  }
  function damageStructuresRandomly(){
    if(!chance(.055))return '';
    const candidates=[];const c=camp();c.damagedBuildings=c.damagedBuildings||{};
    for(const b of (D.campBuildings||[])){if(c.buildings?.[b.id]&&!c.damagedBuildings[b.id])candidates.push({type:'camp',id:b.id,name:`公共营地的${b.name}`});}
    for(const ch of alive()){const s=shelterOf(ch);s.damagedFacilities=s.damagedFacilities||[];if(s.level&&!s.damaged)candidates.push({type:'shelter',owner:ch.id,name:`${ch.name}的${shelterLevelDef(s.level)?.name||'窝棚'}`});for(const fid of s.facilities||[]){if(!s.damagedFacilities.includes(fid)){const f=(D.shelterFacilities||[]).find(x=>x.id===fid);if(f)candidates.push({type:'facility',owner:ch.id,id:fid,name:`${ch.name}窝棚里的${f.name}`});}}}
    if(!candidates.length)return '';
    const x=rand(candidates);if(x.type==='camp')c.damagedBuildings[x.id]=true;else{const s=shelterOf(cBy(x.owner));if(x.type==='shelter')s.damaged=true;else s.damagedFacilities.push(x.id);}
    const text=`意外损坏：${x.name}在风雨、潮气或意外碰撞中受损，需要使用原建造资源的一半进行修复。`;log(text);if(x.owner===state.playerId||x.type==='camp')toast(`⚠ ${x.name}受损`);return text;
  }
  function settleDay(){for(const c of alive()){const beganZero=c.dayStartHealth===0;if(beganZero&&c.health===0)applyDamage(c,1,'长期缺乏食物');else if(c.health>0&&!c.skipDecay){let decay=Number(rules().healthDecayChance)??1;if(c.locationId===camp().locationId&&camp().buildings.water_collector&&!camp().damagedBuildings?.water_collector)decay=Math.max(.35,decay-.10);if(chance(decay))healthDamage(c,1);}c.skipDecay=false;if(c.dead)continue;if(c.health>=2)c.healthyStreak++;else c.healthyStreak=0;if(c.healthyStreak>=3){if(chance(Number(rules().healthyLifeRecoverChance)??.20))addLife(c,1);c.healthyStreak=0;}}state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.selectedLocationId=null;}
  function endDay(){const p=player();if(p.dead)return;runRemainingNpcTurns();applyShelterNightBenefits();const intimate=runCoupleIntimateNight();const report=runCrisis()||runNight();if(intimate)report.text+=(report.text?'\n':'')+`♥ ${intimate.title}：${intimate.text}`;const social=runNightInteractions(intimate?pairKey(intimate.a,intimate.b):'');if(social.length)report.text+=(report.text?'\n':'')+'夜间相处：'+social.join('；');const damageMsg=damageStructuresRandomly();if(damageMsg)report.text+=(report.text?'\n':'')+damageMsg;settleDay();if(p.dead){endGame(false);return;}if(state.day>=80){state.day=81;endGame(true);return;}state.lastNight=report;state.phase='NIGHT_REPORT';sound('night');save();render();}
  function nextDay(){state.day++;state.lastNight=null;startDay(true);}

  function unlock(id){let list=[];try{list=JSON.parse(localStorage.getItem(ACH)||'[]');}catch(e){}if(!list.includes(id)){list.push(id);localStorage.setItem(ACH,JSON.stringify(list));}}
  function endGame(win){const p=player();state.phase=win?'VICTORY':'GAME_OVER';if(win){unlock('day81');if(alive().length===6)unlock('all_alive');if(state.statistics.battles===0)unlock('pacifist');if(state.statistics.battles>=5)unlock('island_boss');}const survived=win?81:Math.max(1,state.day);let score=Math.round((survived/81)*50)+(win?20:0);score+=Math.round(10*((p.life/p.maxLife)*.7+(p.health/3)*.3));score+=Math.min(8,Math.round((p.inventory.filter(id=>!isStarterItem(p,id)).reduce((s,id)=>s+(item(id).value||0),0)/32)*8));score+=Math.max(0,Math.min(7,Math.round(state.statistics.trades*1.5-state.statistics.battles*.6+3)));score+=Math.min(5,Math.round(state.rescueScore));state.score=clamp(Math.round(score),0,100);state.leaderboard=state.leaderboard||{submitted:false};state.endSceneSeen=false;pauseBgm();sound(win?'victory':'defeat');save();render();}
  function rating(score){if(score>=95)return['荒岛传奇','贝爷看了你的生存记录，决定先回去补补课。'];if(score>=85)return['生存大师','你不是在荒岛求生，你像是在这里短期驻场。'];if(score>=70)return['靠谱幸存者','虽然狼狈，但救援船最终看到的是一个还能自己走上船的人。'];if(score>=55)return['命够硬','有些时候你靠策略，有些时候你纯粹靠命。'];if(score>=40)return['岛上老油条','能活这么久，已经不能完全用运气解释。'];if(score>=20)return['生存体验卡','你大概已经知道，下次什么东西不能乱吃了。'];return['三日游游客','无人岛甚至还没来得及记住你的名字。'];}

  function riskHint(ch){const p=player();if(p.id==='suqing')return ch.risk?`风险：${ch.risk}`:'';if(has(p,'binoculars')&&ch.risk==='危险')return '这里似乎有危险……';return ch.stat?`${{str:'力量',agi:'敏捷',int:'知识',luck:'幸运'}[ch.stat]||''}检定`:'';}
  function hearts(c){return '❤️'.repeat(Math.max(0,c.life))+'♡'.repeat(Math.max(0,c.maxLife-c.life));}
  function healthDots(c){return '●'.repeat(c.health)+'○'.repeat(3-c.health);}
  function invHtml(c,interactive=true){let h='';const slots=inventorySlots(c);for(let i=0;i<invLimit(c);i++){const slot=slots[i];if(!slot){h+=`<div class="slot empty"><div class="ico">＋</div><div class="label">空位</div></div>`;continue;}const id=slot.id,it=item(id),starter=isStarterItem(c,id);h+=`<button class="slot ${starter?'starterSlot':''}" ${interactive?`onclick="Game.itemInfo('${id}')"`:''}><div class="ico">${it.ico}</div><div class="label">${esc(it.name)}</div>${slot.count>1?`<span class="stackBadge">×${slot.count}</span>`:''}${starter?'<span class="starterBadge">专属</span>':''}</button>`;}return h;}
  function statusHtml(c){
    const loc=locationById(c.locationId),boost=c.tempBuffDay===state.day;const statBox=(label,key)=>`<div class="stat">${label}<b>${effectiveStat(c,key)}${boost?'<span class="tempBoost">+1</span>':''}</b></div>`;
    return `<section class="card heroStatus"><div class="person heroPerson"><div class="portraitWrap">${portrait(c,'portraitMain')}<span class="roleIcon">${c.avatar}</span></div><div class="heroMeta"><div class="name">${esc(c.name)} · ${esc(c.job)}</div><div class="meta">${c.sex} · ${c.age}岁 · 📍${esc(loc?.name||'未知')}${boost?' · ✨状态加成':''}</div><div class="statusLine">生命 <span class="hearts">${hearts(c)}</span></div><div class="statusLine">健康 <span class="healthdots">${healthDots(c)}</span></div></div><button class="btn small secondary" onclick="Game.survivors()">人物</button></div><div class="stats">${statBox('力量','str')}${statBox('敏捷','agi')}${statBox('知识','int')}${statBox('幸运','luck')}</div></section>`;
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
    return `<section class="card islandCard mapPortraitCard"><div class="row between"><div><div class="section-title">海岛地图</div><div class="name" style="font-size:19px">选择今天要去的地点</div></div><div class="meta">已探索 ${exploredCount}/12</div></div>
      <div class="islandMap portraitMap"><img class="islandMapArt" src="/assets/island-map-3x4.svg" alt="日漫风海岛地图">${D.locations.map(loc=>{const known=state.exploredLocations?.[loc.id],current=p.locationId===loc.id,label=known?loc.name:'未知',storyHere=story?.ready&&story.step.location===loc.id,campHere=loc.id===camp().locationId&&Object.keys(camp().buildings||{}).length;return `<button class="mapSpot ${known?'known':''} ${current?'current':''} ${storyHere?'storySpot':''}" style="left:${loc.x}%;top:${loc.y}%" onclick="Game.move('${loc.id}')"><span class="pin">${current?'🧍':storyHere?'📖':campHere?'🏕️':known?loc.icon:'❓'}</span><span class="spotLabel">${esc(label)}${current?' · 当前':''}${storyHere?' · 剧情':''}</span></button>`;}).join('')}</div>
      <div class="mapLegend">地图以3:4大幅面展示山峰、溪流、树林、沙滩、山洞、沼泽和飞机残骸。点击地点即可前往。</div><button class="btn ghost" style="margin-top:8px" onclick="Game.backLocation()">返回上一页</button></section>`;
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



  function sceneVisualHtml(loc,brief=''){
    const peers=locationPeers(),animal=animalAtLocation(loc?.id),count=peers.length+(animal?1:0);
    return `<section class="scenePanel"><div class="sceneHead"><div><div class="section-title">当前地点</div><div class="sceneName">${esc(loc?.name||'未知地点')}</div></div><span class="sceneCount">${count?`同地点伙伴 ${count}`:'独自一人'}</span></div><div class="sceneImageWrap"><img class="sceneImage" src="${esc(loc?.scene||'')}" alt="${esc(loc?.name||'地点')}场景" loading="eager"><div class="sceneShade"></div>${brief?`<div class="sceneBriefOverlay">${richText(brief)}</div>`:''}${count?`<div class="scenePeople"><div class="scenePeopleTitle">这里的角色与动物</div><div class="scenePeopleRow">${peers.map(c=>`<button class="scenePerson" onclick="Game.personInfo('${c.id}')">${portrait(c,'sceneAvatar')}<span>${esc(c.name)}</span></button>`).join('')}${animal?`<button class="scenePerson animalScenePerson" onclick="Game.animalInfo('${animal.id}')"><img class="sceneAvatar animalAvatar" src="${esc(animal.image)}" alt="${esc(animal.name)}"><span>${esc(animal.name)}</span></button>`:''}</div></div>`:''}</div></section>`;
  }

  function availableActionsHtml(){
    const p=player();if(playerForcedRestToday())return `<section class="card actionHub compactHub"><div class="actionHubHead"><b>今日行动</b><span>休整中</span></div><div class="actionHint">今天别逞强了。既然身体已经替你请假，就安心休息到夜里。</div><div class="compactActions"><button class="quickAction end" onclick="Game.endDay()">🌙<span>结束今天</span></button></div></section>`;
    const peers=locationPeers(),done=(state.interactedTargetsToday||[]),remaining=peers.filter(c=>!done.includes(c.id)),s=shelterOf(p),animal=animalAtLocation(),animalAvailable=animal&&!animalDone(animal.id);
    const interactionChips=peers.length?`<div class="actionPeople">${peers.map(c=>`<button class="actionPerson ${targetInteracted(c.id)?'done':''}" ${targetInteracted(c.id)?'disabled':''} onclick="Game.interact('${c.id}')">${portrait(c,'meetPortrait')}<span>${esc(c.name)}</span><small>${targetInteracted(c.id)?'已互动':relationLabel(p,c)}</small></button>`).join('')}${animal?`<button class="actionPerson animalAction ${animalAvailable?'':'done'}" ${animalAvailable?'':'disabled'} onclick="Game.interactAnimal('${animal.id}')"><img class="meetPortrait animalMeetPortrait" src="${esc(animal.image)}"><span>${esc(animal.name)}</span><small>${animalAvailable?'可互动':'已互动'}</small></button>`:''}</div>`:'';
    const animalOnly=!peers.length&&animal?`<div class="actionPeople"><button class="actionPerson animalAction ${animalAvailable?'':'done'}" ${animalAvailable?'':'disabled'} onclick="Game.interactAnimal('${animal.id}')"><img class="meetPortrait animalMeetPortrait" src="${esc(animal.image)}"><span>${esc(animal.name)}</span><small>${animalAvailable?'可互动':'已互动'}</small></button></div>`:'';
    return `<section class="card actionHub compactHub"><div class="actionHubHead"><b>今日行动</b><span>探索 ${state.exploredToday?'✓':'0/1'} · 人物互动 ${done.length}/${peers.length}${animal?' · 动物 '+(animalAvailable?'0/1':'✓'):''}</span></div>${interactionChips||animalOnly}<div class="compactActions">${!state.exploredToday?`<button class="quickAction explore" onclick="Game.exploreHere()">🔎<span>探索</span></button><button class="quickAction rest" onclick="Game.restHere()">🛏️<span>休整</span></button>`:''}<button class="quickAction shelter" onclick="Game.showShelter()">🏠<span>${s.level?'进窝棚':'搭窝棚'}</span></button><button class="quickAction end" onclick="Game.endDay()">🌙<span>结束今天</span></button></div>${remaining.length?`<div class="actionHint">还可以与 ${remaining.map(c=>esc(c.name)).join('、')} 互动</div>`:''}</section>`;
  }
  function personInfo(id){
    const c=cBy(id),p=player();if(!c)return;const rel=c.id===p.id?'主角':`${relationLabel(p,c)} · ${relationScore(p,c)>0?'+':''}${relationScore(p,c)}`;
    modal(`<div class="row between"><h2>${esc(c.name)}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="personInfoHero">${portrait(c,'personInfoPortrait')}<div><b>${esc(c.job)}</b><div class="meta">${esc(c.sex)} · ${c.age}岁</div><div class="relationText ${c.id===p.id?'':relationClass(p,c)}">${esc(rel)}</div></div></div><div class="personInfoStats"><span>生命 ${hearts(c)}</span><span>健康 ${healthDots(c)}</span><span>力量 ${c.str}</span><span>敏捷 ${c.agi}</span><span>知识 ${c.int}</span><span>幸运 ${c.luck}</span></div><p class="personAbility">${esc(c.ability||'')}</p><div class="meta">当前位置：${esc(locationById(c.locationId)?.name||'未知')} · 背包 ${invUsedSlots(c)}/${invLimit(c)}</div><div class="personAi">${c.id===p.id?'由玩家控制':`AI智能水平：<b>${esc(c.aiLabel||'中等')}</b> · 会主动寻找食物/水、使用公共营地物资并建设自己的窝棚`}</div>${c.shelter?.level?`<div class="meta">🏠 ${esc(shelterLevelDef(c.shelter.level)?.name||'窝棚')} · ${esc(locationById(c.shelter.locationId)?.name||'未知')}</div>`:''}`);
  }
  function backMorning(){if(state.phase==='MAP'&&!state.travelDecisionMade){state.phase='MORNING';save();render();}}
  function renderHome(){
    const s=load();
    const cast=D.characters.map(c=>`<img src="${esc(c.portrait)}" alt="${esc(c.name)}">`).join('');
    app.innerHTML=`<div class="screen center homeScreen"><div class="homeHero"><img src="assets/home-island.jpg" alt="八十一天海岛"></div><div class="subbrand homeSub">DAY 81 · 荒岛生存卡牌冒险</div><div class="castStrip">${cast}</div><div class="tagline">飞机迫降荒岛。六个人活了下来。<br>探索、关系、营地与危机，会让每一局都产生不同的故事。<br><b>救援将在第八十一天到来——前提是，你还活着。</b></div><button class="btn" onclick="Game.selectScreen()">开始游戏</button>${s?'<button class="btn secondary" style="margin-top:10px" onclick="Game.continueGame()">继续游戏</button>':''}<button class="btn ghost" style="margin-top:10px" onclick="Game.showLeaderboard()">🏆 排行榜</button><div class="muted" style="margin-top:16px;font-size:12px">建议开启声音 · 手机首次点击后会自动解锁音效</div><div class="copyrightLine">制作：Wztanhua&nbsp;&nbsp;&nbsp;邮箱：wztanhua@gmail.com</div></div>`;
  }
  function renderSelect(){
    app.innerHTML=`<div class="screen"><div class="brand" style="font-size:28px;text-align:center">选择幸存者</div><div class="grid2">${D.characters.map(c=>`<div class="card character animeCard"><div class="charPortraitBox">${portrait(c,'charPortrait')}</div><div class="name">${esc(c.name)}</div><div class="meta">${c.sex} · ${c.age}岁 · ${esc(c.job)}</div><div class="hearts" style="margin:8px 0">${'❤️'.repeat(c.maxLife)}</div><div class="meta">力量${c.str} · 敏捷${c.agi} · 知识${c.int} · 幸运${c.luck}</div><div class="ability">${esc(c.ability)}</div><div class="ability">专属初始：<span class="itemName">${item(c.startItem).ico}${esc(item(c.startItem).name)}</span><br><span class="muted">永久持有 · 不可交易或被夺取</span></div><button class="btn small" style="margin-top:10px;width:100%" onclick="Game.chooseDifficulty('${c.id}')">选择TA</button></div>`).join('')}</div><button class="btn ghost" onclick="Game.home()">返回</button></div>`;
  }
  function renderDifficulty(playerId){
    const c=D.characters.find(x=>x.id===playerId);
    app.innerHTML=`<div class="screen"><div class="brand" style="font-size:28px;text-align:center">选择难度</div><section class="card difficultyHero">${portrait(c,'portraitDifficulty')}<div><div class="name">${esc(c.name)} · ${esc(c.job)}</div><div class="meta">选择难度后将随机分配六人的初始地点。</div></div></section><div class="difficultyGrid">${Object.entries(DIFFICULTY_META).map(([key,m])=>`<button class="difficultyCard ${key}" onclick="Game.start('${playerId}','${key}')"><b>${m.label}</b><span>${m.desc}</span><em>${key==='normal'?'推荐':''}</em></button>`).join('')}</div><button class="btn ghost" onclick="Game.selectScreen()">返回角色选择</button></div>`;
  }

  function compactHudHtml(){
    const p=player(),loc=locationById(p.locationId),cr=state.crisisNotice,s=shelterOf(p);
    return `<header class="mobileHud"><div class="hudIdentity">${portrait(p,'hudPortrait')}<div><b>${esc(p.name)}</b><small>DAY ${state.day}/81 · ${esc(loc?.name||'未知')}</small></div></div><div class="hudVitals"><span class="life">❤ ${p.life}/${p.maxLife}</span><span class="health">✚ ${p.health}/3</span></div><div class="hudIcons"><button onclick="Game.showOverview()" aria-label="状态">☰</button><button onclick="Game.toggleSound()" aria-label="声音">${soundEnabled?'🔊':'🔇'}</button></div>${cr?`<div class="hudAlert">${cr.icon} ${esc(cr.name)} · ${cr.left===0?'今晚':`${cr.left}天后`}</div>`:''}${s.level?`<div class="hudShelter">🏠 ${esc(shelterLevelDef(s.level)?.name||'窝棚')}</div>`:''}</header>`;
  }
  function quickDockHtml(){
    return `<nav class="quickDock"><button onclick="Game.showStatus()"><span>👤</span>状态</button><button onclick="Game.showInventory()"><span>🎒</span>背包</button><button onclick="Game.survivors()"><span>👥</span>人物</button><button onclick="Game.showCamp()"><span>🏕️</span>营地</button><button onclick="Game.showShelter()"><span>🏠</span>窝棚</button><button onclick="Game.logs()"><span>📖</span>日志</button></nav>`;
  }
  function miniSceneHtml(loc,overlayTitle='',overlayText='',typing=false,showPeople=true){
    const peers=locationPeers(),animal=animalAtLocation(loc?.id),count=peers.length+(animal?1:0);
    const partnerInfo=showPeople?(count?`同地点伙伴${count}`:'独自一人'):'';
    const people=showPeople?`<div class="sceneStripPeople">${peers.map(c=>`<button onclick="Game.personInfo('${c.id}')">${portrait(c,'sceneAvatar')}<span>${esc(c.name)}</span></button>`).join('')}${animal?`<button onclick="Game.animalInfo('${animal.id}')"><img class="sceneAvatar animalAvatar" src="${esc(animal.image)}"><span>${esc(animal.name)}</span></button>`:''}</div>`:'';
    return `<section class="sceneStrip eventSceneStrip"><div class="sceneStripHead"><b>${esc(loc?.name||'未知地点')}</b><span>${partnerInfo}</span></div><div class="sceneStripImage"><img src="${esc(loc?.scene||'')}" alt="${esc(loc?.name||'地点')}"><div class="sceneStripShade"></div>${overlayTitle||overlayText?`<div class="sceneEventOverlay">${overlayTitle?`<b>${esc(overlayTitle)}</b>`:''}<div ${typing?'id="eventText"':''}>${typing?'':richText(overlayText)}</div></div>`:''}${people}</div></section>`;
  }

  function showStatus(){
    const p=player(),loc=locationById(p.locationId),s=shelterOf(p);modal(`<div class="row between"><h2>角色状态</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div>${statusHtml(p)}<div class="infoGrid"><span>难度 <b>${esc(state.difficultyLabel)}</b></span><span>位置 <b>${esc(loc?.name||'未知')}</b></span><span>AI/技能 <b>主角操控</b></span><span>窝棚 <b>${s.level?esc(shelterLevelDef(s.level)?.name):'未搭建'}</b></span></div><button class="btn ghost" onclick="Game.closeModal();Game.restartAsk()">重新开始本局</button>`);
  }
  function showInventory(){
    const p=player();modal(`<div class="row between"><h2>🎒 背包 ${invUsedSlots(p)}/${invLimit(p)}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="inventory inventory8 modalInventory">${invHtml(p,true)}</div><p class="muted">点击道具查看效果。专属初始道具永久持有。</p>`);
  }
  function showOverview(){
    const s=activeStoryTarget(),cr=state.crisisNotice;
    const fontButtons=['small','medium','large'].map(k=>`<button class="settingPill ${fontSizePref===k?'active':''}" onclick="Game.setFontSize('${k}')">${{small:'小',medium:'中',large:'大'}[k]}</button>`).join('');
    const bgmButtons=Object.entries(BGM_TRACKS).map(([k,v])=>`<button class="settingPill ${bgmChoice===k?'active':''}" onclick="Game.setBgm('${k}')">${k==='off'?'关闭':esc(v.label)}</button>`).join('');
    modal(`<div class="row between"><h2>本局资料</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div>
      <div class="settingsBlock"><b>显示字体</b><span class="muted">可按阅读习惯切换，小/中/大三档会立即生效。</span><div class="settingPills">${fontButtons}</div></div>
      <div class="settingsBlock"><b>背景音乐</b><span class="muted">这里只显示管理后台已启用的曲目。手机端首次触摸后会自动解锁。</span><div class="settingPills musicPills">${bgmButtons}</div><div class="meta">总声音：${soundEnabled?'开启':'静音'} · 右上角扬声器会同时控制背景音乐和音效</div></div>
      <div class="overviewList"><button class="choice" onclick="Game.closeModal();Game.showStatus()">👤 角色状态</button><button class="choice" onclick="Game.closeModal();Game.showInventory()">🎒 背包</button><button class="choice" onclick="Game.closeModal();Game.survivors()">👥 人物列表</button><button class="choice" onclick="Game.closeModal();Game.showCamp()">🏕️ 公共营地</button><button class="choice" onclick="Game.closeModal();Game.showShelter()">🏠 我的窝棚</button><button class="choice" onclick="Game.closeModal();Game.logs()">📖 重要日志</button></div>
      ${cr?`<div class="crisisBanner now"><div class="crisisIcon">${cr.icon}</div><div><b>${esc(cr.name)}</b><span>${cr.left===0?'今晚发生':`${cr.left}天后发生`} · ${esc(cr.desc)}</span></div></div>`:''}
      ${s?`<div class="storyHint"><span>📖</span><div><b>${esc(s.chain.name)}</b><small>${s.ready?'新线索：'+esc(locationById(s.step.location)?.name||'未知'):`等待${s.wait}天`}</small></div></div>`:''}<div class="copyrightLine overviewCopyright">制作：Wztanhua&nbsp;&nbsp;&nbsp;邮箱：wztanhua@gmail.com</div>`);
  }
  function renderMain(){
    const p=player();if(state.phase==='NIGHT_REPORT')return renderNight();if(state.phase==='VICTORY'||state.phase==='GAME_OVER')return renderEnd();let center='',typeAfter=null;const loc=locationById(p.locationId),orderText=(state.dailyActionOrder||[]).map(id=>id===p.id?'你':(cBy(id)?.name||id)).join(' → ');
    if(state.phase==='MAP') center=mapHtml();
    else if(state.phase==='MORNING'){
      if(playerForcedRestToday())center=`${sceneVisualHtml(loc,state.locationBrief||makeLocationBrief(p.locationId,false))}<section class="paper morningChoice compactMorning forcedRestCard"><div class="section-title">今天必须休整</div><div class="actionOrderLine">🎲 今日行动顺序：${esc(orderText)}</div><div class="event-title">昨夜有点太投入，今天身体先投了反对票。</div><div class="event-text">你无法探索，也不能前往其他地点。好好睡一觉，明天再继续折腾这座岛。</div><button class="btn" onclick="Game.forcedRest()">🛏️ 老实休整一天</button></section>`;
      else center=`${sceneVisualHtml(loc,state.locationBrief||makeLocationBrief(p.locationId,false))}<section class="paper morningChoice compactMorning"><div class="section-title">新的一天 · 先决定停留地点</div><div class="actionOrderLine">🎲 今日行动顺序：${esc(orderText)}</div><div class="choices twoChoices"><button class="choice actionPrimary" onclick="Game.stayHere()">📍 留在当地<small>${esc(loc?.name||'这里')}</small></button><button class="choice" onclick="Game.openMap()">🗺️ 前往其他地点<small>打开地图选择</small></button></div></section>`;
    }
    else if(state.phase==='TRAVEL'){
      const e=state.travelEvent||{},resolved=!!state.travelEventResult;let buttons='';
      if(e.type==='choice'&&!resolved)buttons=(e.choices||[]).map((ch,i)=>`<button class="choice" onclick="Game.travelChoice(${i})">${esc(ch.text)}<small>${esc(riskHint(ch))}</small></button>`).join('');
      center=`${miniSceneHtml(loc,e.name||'途中事件',e.text||'前往新地点的路上发生了一点意外。')}<section class="paper travelPaper compactPaper"><div class="section-title">移动途中</div>${resolved?`<div class="result richResult">${richResultText(state.travelEventResult)}</div><button class="btn" onclick="Game.finishTravel()">继续前往 ${esc(loc?.name||'目的地')}</button>`:`<div class="choices compactChoices">${buttons}</div>`}</section>`;
    }
    else if(state.phase==='LOCATION') center=`${sceneVisualHtml(loc,state.locationBrief||loc?.desc||'')}${availableActionsHtml()}`;
    else if(state.phase==='INTERACTION'){
      const it=state.interaction,o=cBy(it?.targetId),scene=it?.scene,rel=relationScore(p,o),utilityUsed=!socialActionAvailable();
      const canTrade=!utilityUsed&&!enemy(p,o)&&tradableItems(p).length&&tradableItems(o).length,canGift=!utilityUsed&&tradableItems(p).length>0,canRob=!utilityUsed&&lootableItems(o).length>0&&!isCouplePair(p,o);
      const dialogueRows=scene.dialogue||(scene.dialogue=interactionDialogue(o,scene));
      const idx=Math.min(it.dialogueIndex||0,dialogueRows.length),talkDone=idx>=dialogueRows.length,current=talkDone?null:dialogueRows[idx],speaker=current?cBy(current.who):null,mine=current?.who===p.id;
      const talk=!it.storyResolved?`<section class="rpgDialogue ${mine?'mine':''}">${speaker?portrait(speaker,'rpgSpeakerPortrait'):''}<div class="rpgBubble"><b>${speaker?esc(speaker.name):''}</b><div>${current?richText(current.text):'你们把话说到这里，接下来该由你决定怎么回应。'}</div>${!talkDone?`<button class="dialogueNext" onclick="Game.advanceDialogue()">继续 <span>›</span></button>`:''}</div></section>`:'';
      let panel='';
      if(!it.storyResolved&&talkDone){panel=`<section class="paper encounterPaper compactPaper interactionPaper"><div class="interactionSceneTitle">${esc(scene.title||'简单交谈')}</div><div class="choices compactChoices interactionStoryChoices">${scene.choices.map((ch,i)=>`<button class="choice" onclick="Game.interactionChoice(${i})">${esc(ch.text)}<small>${ch.kind==='check'?esc(riskHint({stat:ch.stat,risk:ch.risk})):esc(ch.risk||'')}</small></button>`).join('')}</div></section>`;}
      if(it.storyResolved){panel=`<section class="paper encounterPaper compactPaper interactionPaper postTalkPanel"><div class="section-title">互动结果</div><div class="result richResult">${richResultText(it.storyResult||'')}</div><div class="interactionUtilityLabel">${utilityUsed?'今天已经进行过一次物品互动':'接下来，你还可以选择一次物品互动'}</div><div class="interactionUtility"><button ${canTrade?'':'disabled'} onclick="Game.interactionTrade()">🤝<span>交易</span></button><button ${canGift?'':'disabled'} onclick="Game.interactionGift()">🎁<span>赠送</span></button><button class="rob" ${canRob?'':'disabled'} onclick="Game.interactionRob()">⚔️<span>${isCouplePair(p,o)?'情侣不可抢夺':'抢夺'}</span></button><button onclick="Game.finishInteraction()">↩<span>结束互动</span></button></div></section>`;}
      center=`<section class="interactionVisual rpgInteractionVisual dialogueOnlyVisual"><img class="interactionBg" src="${esc(loc?.scene||'')}" alt="${esc(loc?.name||'地点')}互动场景"><div class="interactionShade"></div><div class="interactionRel ${relationClass(p,o)}">${relationLabel(p,o)} · ${rel>0?'+':''}${rel}</div><div class="rpgDialogueOverlay">${talk}</div></section>${panel}`;
    }
    else if(state.phase==='ANIMAL_INTERACTION'){
      const ai=state.animalInteraction,a=animalDef(ai?.animalId),e=ai?.event;
      center=`<section class="animalInteractionScene"><img src="${esc(loc?.scene||'')}" class="animalInteractionBg"><div class="animalInteractionShade"></div><img src="${esc(a?.image||'')}" class="animalInteractionPortrait" alt="${esc(a?.name||'动物')}"><div class="animalDialogueCard"><div class="section-title">${a?.icon||'🐾'} 动物互动 · ${esc(a?.name||'')}</div><div class="event-title">${esc(e?.name||'偶遇')}</div><div class="event-text">${richText(e?.text||'')}</div></div></section><section class="paper animalChoicePaper"><div class="choices compactChoices">${(e?.choices||[]).map((ch,i)=>`<button class="choice" onclick="Game.animalChoice(${i})">${esc(ch.text)}</button>`).join('')}</div></section>`;
    }
    else if(state.phase==='EVENT'&&state.currentEvent){
      const e=state.currentEvent,key=`${state.day}-${e.id}`,shouldType=lastTypedKey!==key,controls=e.choices.map((ch,i)=>`<button class="choice" onclick="Game.resolve(${i})">${esc(ch.text)}<small>${esc(riskHint(ch))}</small></button>`).join('');
      center=`${miniSceneHtml(loc,e.name,e.text,shouldType,false)}<section class="paper eventPaper compactPaper ${e.storyChain?'storyPaper':''}"><div class="section-title">${e.storyChain?'📖 '+esc(e.storyName):'今日探索'} · ${esc(loc?.name||'')}</div><div class="choices compactChoices ${shouldType?'typingLocked':''}" id="eventChoices">${controls}</div></section>`;if(shouldType){lastTypedKey=key;typeAfter=()=>typeText(document.getElementById('eventText'),e.text);}
    }
    else if(state.phase==='POST'||state.phase==='POST_ACTION'){
      const isExplore=state.phase==='POST';center=`${miniSceneHtml(loc,isExplore?state.currentEvent?.name:'行动完成',isExplore?(state.currentEvent?.text||''):'',false,false)}<section class="paper eventPaper resultPaper"><div class="section-title">${isExplore?'探索结果':'行动结果'} · ${esc(loc?.name||'')}</div>${isExplore?`<div class="event-title">${esc(state.currentEvent?.name||'今日探索')}</div>`:''}<div class="result richResult">${richResultText(state.currentResult)}</div></section>${availableActionsHtml()}`;
    } else {state.phase=state.travelDecisionMade?'LOCATION':'MORNING';return renderMain();}
    app.innerHTML=`<div class="screen gameScreen">${compactHudHtml()}<main class="gameStage phase-${state.phase.toLowerCase()}">${center}</main>${quickDockHtml()}</div>`;if(state.pending)renderPending();if(typeAfter)setTimeout(typeAfter,70);setTimeout(maybeShowDeathAlert,80);
  }
  function renderNight(){
    const loc=state.lastNight?.locationId?locationById(state.lastNight.locationId):null,affected=loc&&player().locationId===loc.id,intimate=state.lastIntimateEvent;
    const hearts=intimate?`<div class="heartRise">${Array.from({length:12},(_,i)=>`<i style="--i:${i}">♥</i>`).join('')}</div>`:'';
    app.innerHTML=`<div class="screen center nightScreen">${hearts}<div class="nightHero16x9"><img src="/assets/night/night-sky-16x9.jpg" alt="海岛夜空"><div class="nightHeroCaption">DAY ${state.day} · 夜色降临</div></div><section class="paper nightPaper ${intimate?'intimateNightPaper':''}"><div class="section-title">夜间事件${loc?` · ${esc(loc.name)}`:''}</div>${intimate?`<div class="intimateNightTag">♥ 今夜，你和${esc(cBy(state.coupleId)?.name||'恋人')}有一段只属于彼此的安静时光</div>`:''}<div class="event-title">${esc(state.lastNight.title)}</div><div class="event-text">${richText(state.lastNight.text)}</div>${loc?`<div class="nightScope ${affected?'affected':''}">${affected?'⚠ 该事件发生在你所在地点':'该事件只影响 '+esc(loc.name)+' 的幸存者'}</div>`:''}</section><button class="btn" onclick="Game.nextDay()">进入 DAY ${state.day+1}</button></div>`;
  }
  function showFinalReport(){state.endSceneSeen=true;save();render();}
  function renderEnd(){
    const p=player(),win=state.phase==='VICTORY',survived=win?81:Math.max(1,state.day);if(!state.endSceneSeen){const bg=win?'/assets/scenes/moon_bay.jpg':(locationById(p.locationId)?.scene||'/assets/scenes/crash_beach.jpg');app.innerHTML=`<div class="endCinematic ${win?'win':'fail'}"><img class="cinematicBg" src="${esc(bg)}" alt="结局"><div class="cinematicShade"></div>${win?'<div class="rescueGlow"></div>':'<div class="failRain"></div>'}<div class="cinematicContent">${win?'<div class="rescueShip">🚢</div>':portrait(p,'cinematicPortrait')}<h1>${win?'救援来了！':'求生在这里停下'}</h1><p>${win?'海面上的船越来越近。有人在甲板上挥手，你几乎忘了该先笑还是先喊。八十一天，终于走到了尽头。':`DAY ${state.day}。${esc(p.name)}没能继续撑下去。岛上的风还在吹，今天却少了一个脚步声。`}</p><button class="btn cinematicAction" onclick="Game.showFinalReport()">查看表现</button></div></div>`;return;}
    const [title,txt]=rating(state.score),lb=state.leaderboard||{submitted:false};app.innerHTML=`<div class="screen center"><div class="subbrand">${win?'DAY 81 · RESCUE':'SURVIVAL ENDED'}</div><div class="brand" style="font-size:34px">${win?'顺利获救':'本局结束'}</div><div class="score">${state.score}</div><div class="name">${title}</div><div class="tagline" style="margin:10px auto 18px">${txt}</div><section class="card" style="text-align:left"><div class="section-title">综合表现</div><div class="row between"><span>幸存天数</span><b>${survived}天</b></div><div class="row between"><span>难度</span><b>${esc(state.difficultyLabel)}</b></div><div class="row between"><span>最终得分</span><b>${state.score}</b></div><div class="row between"><span>探索地点</span><b>${Object.keys(state.completedExploreLocations||{}).length}/12</b></div><div class="row between"><span>交易 / 战斗</span><b>${state.statistics.trades} / ${state.statistics.battles}</b></div></section><section class="card leaderboardSubmit"><div class="section-title">🏆 提交排行榜</div>${lb.submitted?`<div class="rankSuccess">账号 <b>${esc(lb.account)}</b> 当前排名：<strong>#${lb.rank||'-'}</strong></div>`:`<div class="meta" style="margin-bottom:10px">输入6—8个字符的账号。相同账号只保留最好成绩。</div><div class="submitRow"><input id="rankAccount" maxlength="8" placeholder="6-8字符账号"><button class="btn small" onclick="Game.submitScore()">提交</button></div><div id="rankMsg" class="rankMsg"></div>`}<button class="btn ghost" style="margin-top:10px" onclick="Game.showLeaderboard()">查看前100名</button></section><section class="card" style="text-align:left"><div class="section-title">最终幸存者</div>${state.characters.map(c=>`<div class="row between ${c.dead?'dead':''}" style="padding:7px 0"><span class="endPerson">${portrait(c,'endPortrait')} ${esc(c.name)}</span><span>${c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:'获救'}</span></div>`).join('')}</section><button class="btn" onclick="Game.selectScreen()">再来一次</button><button class="btn ghost" onclick="Game.home()">返回首页</button></div>`;
  }
  function renderPending(){
    const p=player();if(state.pending.type==='pick'){const opts=state.pending.choices.map(id=>`<button class="choice" onclick="Game.pickItem('${id}')">${item(id).ico} <b class="itemName">${esc(item(id).name)}</b><small>${esc(item(id).desc)}</small></button>`).join('');document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>选择一件物资</h2><p class="muted">你只能带走其中一件。</p><div class="choices">${opts}</div></div></div>`);return;}
    const id=state.pending.incoming,it=item(id),old=[...new Set(discardableItems(p))].map(x=>`<button class="choice" onclick="Game.replace('${x}')">丢弃 ${item(x).ico} <b class="itemName">${esc(item(x).name)}</b></button>`).join('');
    document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>背包已满</h2><p>新获得：${it.ico} <b class="itemName">${esc(it.name)}</b></p><p class="muted">专属初始道具不可丢弃。请选择一件普通道具丢弃，或放弃新道具。</p><div class="choices">${old}<button class="choice" onclick="Game.replace('__new__')">放弃 ${esc(it.name)}</button></div></div></div>`);
  }

  function modal(html){document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="modal"><div class="modal">${html}</div></div>`);}
  function closeModal(){document.getElementById('modal')?.remove();}
  function itemInfo(id){closeModal();const it=item(id),starter=isStarterItem(player(),id),can=it.consumable&&['MORNING','LOCATION','MAP','POST','POST_ACTION'].includes(state.phase),count=player().inventory.filter(x=>x===id).length;modal(`<div class="row between"><h2>${it.ico} <span class="itemName">${esc(it.name)}</span>${it.consumable&&count>1?` <small>×${count}</small>`:''}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><p>${esc(it.desc)}</p><div class="muted">${starter?'角色专属 · 永久持有 · 不可交易 / 夺取 / 丢弃':it.consumable?'消耗品 · 相同物品每个背包格最多叠加2个':'携带生效 · 同名效果不叠加'}</div>${can?`<button class="btn" style="margin-top:14px" onclick="Game.use('${id}')">使用1个</button>`:''}`);}
  function characterCurrentScore(c){
    // 实时人物分强调“本局成长”，避免开局因满状态/基础属性直接出现数百分。
    const survivalDays=Math.max(1,c.dead?(c.deathDay||1):state.day);
    const invValue=(c.inventory||[]).filter(id=>!isStarterItem(c,id)).reduce((s,id)=>s+(item(id)?.value||0),0);
    const shel=homeShelterOf(c),explored=c.id===state.playerId?Object.keys(state.completedExploreLocations||{}).length:Object.keys(c.aiExplored||{}).length;
    const attrs=['str','agi','int','luck'].reduce((s,k)=>s+effectiveStat(c,k),0);
    const st=c.stats||{},positiveRelations=c.id===state.playerId?alive().filter(x=>x.id!==c.id).reduce((s,x)=>s+Math.max(0,relationScore(c,x)),0):Math.max(0,relationScore(player(),c));
    let score=20;
    score+=(survivalDays-1)*2.4;
    score+=explored*4;
    score+=shel.level*18+(shel.facilities?.length||0)*7;
    score+=Math.min(50,invValue*.35);
    score+=Math.max(0,(st.itemsFound||0)-1)*.8+(st.trades||0)*2.5+(st.wins||0)*5+(st.avoids||0)*1.5;
    score+=Math.min(30,positiveRelations*.06);
    score+=Math.max(0,attrs-14)*4;
    if(c.id===state.playerId)score+=Math.min(30,(state.rescueScore||0)*3);
    score-=Math.max(0,c.maxLife-c.life)*8+Math.max(0,3-c.health)*3;
    if(c.dead)score-=12;
    return clamp(Math.round(score),0,899);
  }
  function survivors(){
    const ploc=player().locationId,p=player(),rows=[...state.characters].sort((a,b)=>characterCurrentScore(b)-characterCurrentScore(a));
    const htmlRows=rows.map((c,i)=>{
      const hs=homeShelterOf(c),homeLine=state.day>=20&&hs.level?` · 🏠${esc(locationById(hs.locationId)?.name||'未知')}`:'',where=(c.id===state.playerId||c.locationId===ploc)?`📍${esc(locationById(c.locationId)?.name||'未知')}`:'位置未知';
      const status=c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:`生命 ${hearts(c)} · 健康 ${healthDots(c)} · ${where}${c.id!==state.playerId?` · AI ${esc(c.aiLabel||'中等')}`:''}${homeLine}`;
      const relation=(c.id!==p.id&&!c.dead)?`<div class="relationMeter"><i style="width:${clamp((relationScore(p,c)+100)/2,0,100)}%"></i></div><div class="relationText ${relationClass(p,c)}">${relationLabel(p,c)} · ${relationScore(p,c)>0?'+':''}${relationScore(p,c)}</div>`:`<div class="relationText">${c.id===p.id?'主角':'已离队'}</div>`;
      return `<div class="listItem relationItem ${c.dead?'dead':''}"><div class="rankBadge">${i+1}</div>${portrait(c,'listPortrait')}<div class="relationBody"><div class="row between"><b>${esc(c.name)} · ${esc(c.job)}</b><strong class="currentScore">${characterCurrentScore(c)}分</strong></div><div class="meta">${status}</div>${relation}</div></div>`;
    }).join('');
    modal(`<div class="row between"><h2>人物列表</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="peopleScoreHint">根据生命、健康、属性、物资、窝棚、探索和本局表现综合计算 · 实时排序</div><div class="list scoredPeople">${htmlRows}</div>`);
  }
  function logs(){modal(`<div class="row between"><h2>重要日志</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="log">${state.history.length?state.history.slice().reverse().map(x=>`<div class="listItem"><b>DAY ${x.day}</b><br>${richText(x.msg)}</div>`).join(''):'还没有值得记录的事。'}</div>`);}


  function showCamp(){
    if(!state){toast('开始游戏后才能查看营地');return;}
    closeModal();const c=camp(),here=player().locationId===c.locationId;const labels={wood:'木材',fiber:'藤条',scrap:'零件'};c.damagedBuildings=c.damagedBuildings||{};
    const buildings=(D.campBuildings||[]).map(b=>{const built=!!c.buildings[b.id],damaged=!!c.damagedBuildings[b.id],cost=Object.entries(b.cost||{}).map(([k,v])=>`${labels[k]}×${v}`).join(' · '),repair=effectiveCost(player(),halfCost(b.cost)),repairTxt=Object.entries(repair).map(([k,v])=>`${labels[k]}×${v}`).join(' · ');return `<div class="campBuild ${built?'built':''} ${damaged?'damaged':''}"><div class="campBuildIcon">${b.icon}</div><div class="campBuildText"><b>${esc(b.name)} ${damaged?'<em class="damageTag">受损</em>':''}</b><span>${esc(b.desc)}</span><small>${damaged?'损坏期间效果失效 · 修复 '+repairTxt:built?'已建成':cost}</small></div>${damaged?`<button class="btn small danger" ${here&&canAffordMaterials(repair)?'':'disabled'} onclick="Game.repairCampBuilding('${b.id}')">修复</button>`:built?'<em>✓</em>':`<button class="btn small" ${here&&canBuild(b)?'':'disabled'} onclick="Game.buildCamp('${b.id}')">建造</button>`}</div>`;}).join('');
    modal(`<div class="row between"><h2>🏕️ 公共营地</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="campLocation">📍 林中空地 ${here?'<b>· 你正在这里</b>':'· 前往此地才能建造、修复和领取物资'}</div><div class="campMaterials"><span>🪵 木材 <b>${c.materials.wood||0}</b></span><span>🌿 藤条 <b>${c.materials.fiber||0}</b></span><span>⚙️ 零件 <b>${c.materials.scrap||0}</b></span></div><div class="campStorage"><button class="choice" ${here&&c.storedWater>0?'':'disabled'} onclick="Game.claimCamp('water')">💧 净水储备 ×${c.storedWater||0}<small>领取后健康+1</small></button><button class="choice" ${here&&c.storedFood>0?'':'disabled'} onclick="Game.claimCamp('food')">🐟 食物储备 ×${c.storedFood||0}<small>领取一份烤鱼</small></button></div><div class="section-title" style="margin-top:16px">营地设施</div><div class="campBuildList">${buildings}</div><p class="muted" style="font-size:12px;line-height:1.6">少数风雨、潮气或意外碰撞可能损坏营地设施。受损设施会暂时失效，使用原建造资源约一半即可修复。</p>`);
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


  function maybeShowCoupleHomeChoice(){
    if(!state?.coupleHomeChoice||document.querySelector('.modalWrap'))return;const p=player(),o=cBy(state.coupleHomeChoice.partnerId),ps=shelterOf(p),os=shelterOf(o);if(!o)return;
    if(!ps.level&&!os.level){state.coupleHomeChoice=null;return;}
    if(!(ps.level&&os.level)){finalizeCoupleHome(ps.level?p.id:o.id);save();return;}
    const card=(c,s)=>`<button class="choice coupleHomeCard" onclick="Game.chooseCoupleHome('${c.id}')">🏠 <b>${esc(shelterLevelDef(s.level)?.name||'窝棚')}</b><small>📍 ${esc(locationById(s.locationId)?.name||'未知地点')} · Lv.${s.level} · 设施${s.facilities.length}/4</small><span>把这里作为两个人共同的家</span></button>`;
    modal(`<div class="coupleHomeModal"><div class="relationAlertTag">情侣共同住所</div><h2>以后，回哪一个“家”？</h2><p>${esc(o.name)}看了看你：“两处窝棚来回照看太费劲了。我们留一处吧。”</p><div class="choices">${card(p,ps)}${card(o,os)}</div><div class="meta">选定后另一处窝棚将被废弃，材料不会返还。</div></div>`);sound('story');
  }
  function chooseCoupleHome(ownerId){document.getElementById('modal')?.remove();finalizeCoupleHome(ownerId);save();render();}
  function maybeShowSystemAlert(){
    if(!state?.systemAlerts?.length||document.querySelector('.modalWrap'))return;const a=state.systemAlerts[0];modal(`<div class="systemAlert"><div class="systemAlertIcon">${a.icon||'ℹ️'}</div><h2>${esc(a.title||'提示')}</h2><p>${richText(a.text||'')}</p><button class="btn" onclick="Game.closeSystemAlert()">知道了</button></div>`);sound('good');
  }
  function closeSystemAlert(){document.getElementById('modal')?.remove();if(state?.systemAlerts?.length)state.systemAlerts.shift();save();setTimeout(()=>{if(state?.deathAlerts?.length)maybeShowDeathAlert();else if(state?.relationAlerts?.length)maybeShowRelationAlert();else if(state?.coupleHomeChoice)maybeShowCoupleHomeChoice();else maybeShowSystemAlert();},80);}

  function maybeShowDeathAlert(){
    if(!state?.deathAlerts?.length||document.querySelector('.modalWrap'))return;
    const a=state.deathAlerts[0],c=cBy(a.id);modal(`<div class="deathAlert"><div class="deathAlertIcon">⚠</div><h2>重要讯息</h2>${c?portrait(c,'deathPortrait'):''}<div class="deathName">${esc(a.name)} 已死亡</div><p>DAY ${a.day} · ${esc(a.cause||'生命归零')}</p><button class="btn danger" onclick="Game.closeDeathAlert()">知道了</button></div>`);sound('warning');
  }
  function closeDeathAlert(){document.getElementById('modal')?.remove();if(state?.deathAlerts?.length)state.deathAlerts.shift();save();setTimeout(()=>{if(state?.deathAlerts?.length)maybeShowDeathAlert();else if(state?.relationAlerts?.length)maybeShowRelationAlert();else if(state?.coupleHomeChoice)maybeShowCoupleHomeChoice();else maybeShowSystemAlert();},80);}

  function maybeShowRelationAlert(){
    if(!state?.relationAlerts?.length||document.querySelector('.modalWrap'))return;
    const a=state.relationAlerts[0],c=cBy(a.id);const arrow=a.from===a.to?'→':`${esc(a.from)} → ${esc(a.to)}`;
    modal(`<div class="relationAlert ${a.positive?'positive':'negative'}">${c?portrait(c,'relationAlertPortrait'):''}<div class="relationAlertTag">关系变化</div><h2>${esc(a.name)}</h2><div class="relationJump">${arrow}</div>${a.reason?`<p>${esc(a.reason)}</p>`:''}${a.special?`<div class="specialDialogue">${richText(a.special)}</div>`:''}<button class="btn ${a.positive?'':'danger'}" onclick="Game.closeRelationAlert()">知道了</button></div>`);sound(a.positive?'good':'bad');
  }
  function closeRelationAlert(){document.getElementById('modal')?.remove();if(state?.relationAlerts?.length)state.relationAlerts.shift();save();setTimeout(()=>{if(state?.deathAlerts?.length)maybeShowDeathAlert();else if(state?.relationAlerts?.length)maybeShowRelationAlert();else if(state?.coupleHomeChoice)maybeShowCoupleHomeChoice();else maybeShowSystemAlert();},80);}

  function render(){document.querySelectorAll('.modalWrap').forEach(x=>x.remove());if(!state){renderHome();return;}renderMain();if(state.pending&&!document.getElementById('pending'))renderPending();setTimeout(()=>{if(state?.deathAlerts?.length)maybeShowDeathAlert();else if(state?.relationAlerts?.length)maybeShowRelationAlert();else if(state?.coupleHomeChoice)maybeShowCoupleHomeChoice();else maybeShowSystemAlert();},100);}

  window.Game={
    home(){state=null;renderHome();},selectScreen(){app.innerHTML='';renderSelect();},chooseDifficulty(id){renderDifficulty(id);},continueGame(){state=load();if(!state){renderHome();return;}render();},
    start(id,difficultyKey){if(load()&&!confirm('开始新游戏会覆盖旧存档，确定吗？'))return;state=newState(id,difficultyKey||'normal');log(`${player().name}成为主角。初始位置：${locationById(player().locationId).name}。`);startDay(true);},
    exploreHere:exploreCurrent,resolve:resolveInstantOrCheck,endDay,nextDay,itemInfo,survivors,logs,closeModal,use(id){closeModal();useItem(player(),id);},toggleSound,showCamp,buildCamp,claimCamp,repairCampBuilding,showShelter,buildOwnShelter,upgradeOwnShelter,installShelterFacility,repairOwnShelter,repairShelterFacility,showStatus,showInventory,showOverview,setFontSize,setBgm,closeDeathAlert,closeRelationAlert,closeSystemAlert,chooseCoupleHome,
    openMap,stayHere:chooseStay,move:moveToLocation,travelChoice:resolveTravelChoice,finishTravel:finishTravelArrival,backLocation:backMorning,personInfo,animalInfo,interactAnimal:beginAnimalInteraction,animalChoice:resolveAnimalInteraction,interact:beginInteraction,advanceDialogue:advanceInteractionDialogue,finishInteraction,interactionChoice,interactionTrade:interactionTradeModal,interactionTradeChoose,interactionGift:interactionGiftModal,interactionGiftChoose,interactionRob,cancelInteraction,restHere:restAtLocation,forcedRest:forcedRestAction,
    replace(oldId){const p=player(),incoming=state.pending.incoming;if(oldId!=='__new__'){if(isStarterItem(p,oldId)){toast('专属初始道具不可丢弃');return;}const i=p.inventory.indexOf(oldId);if(i>=0)p.inventory.splice(i,1,incoming);toast(`丢弃${item(oldId).name}，留下${item(incoming).name}`);}else toast(`放弃${item(incoming).name}`);state.pending=null;save();render();},
    pickItem(id){state.pending=null;gainItem(player(),id,'选择获得');save();render();},restartAsk(){if(confirm('确定放弃当前进度并重新开始吗？')){localStorage.removeItem(SAVE);state=null;renderSelect();}},
    showLeaderboard,submitScore,showFinalReport
  };

  document.addEventListener('pointerdown',unlockAudio,{passive:true});
  document.addEventListener('touchstart',unlockAudio,{passive:true});
  document.addEventListener('click',unlockAudio,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)unlockAudio();else pauseBgm();});

  async function boot(){
    try{const r=await fetch('/api/game-config',{cache:'no-store'});if(r.ok){const cfg=await r.json();GAME_CONFIG={roleNames:{...DEFAULT_GAME_CONFIG.roleNames,...(cfg.roleNames||{})},difficulty:{...DEFAULT_GAME_CONFIG.difficulty,...(cfg.difficulty||{})},music:{tracks:Array.isArray(cfg.music?.tracks)?cfg.music.tracks:DEFAULT_GAME_CONFIG.music.tracks}};configureBgmTracks(GAME_CONFIG.music.tracks);}}catch(e){console.warn('game config unavailable, using defaults',e);configureBgmTracks(DEFAULT_GAME_CONFIG.music.tracks);}
    applyNamesToCharacters(D.characters);applyFontSize();renderHome();
  }
  boot();
})();
