(() => {
  'use strict';

  const D = window.DAY81_DATA;
  const NPC = window.DAY81_NPC;
  const SAVE = 'day81_save_v9';
  const ACH = 'day81_achievements_v1';
  const SOUND_KEY = 'day81_sound';
  const app = document.getElementById('app');

  const DEFAULT_GAME_CONFIG = {
    roleNames: {linlan:'林岚',zhouye:'周野',chenmo:'陈默',suqing:'苏晴',gaoyuan:'高远',xutang:'许棠'},
    difficulty: {nightEventChance:.70,baseCheckModifier:0,healthDecayChance:1,healthyLifeRecoverChance:.20,inventoryLimit:8,startingBonusFood:0,hostileBattleChance:.20,eventRecentWindow:24,interactionRecentWindow:18,bondThreshold:60,npcSaveChanceDay30:.82,npcSaveChanceDay50:.52}
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
  function isStarterItem(c,id){ return !!id && (id===c?.startItem || item(id)?.starter); }
  function tradableItems(c){ return (c?.inventory||[]).filter(id=>!isStarterItem(c,id) && item(id)?.tradable!==false); }
  function lootableItems(c){ return (c?.inventory||[]).filter(id=>!isStarterItem(c,id) && item(id)?.lootable!==false); }
  function discardableItems(c){ return (c?.inventory||[]).filter(id=>!isStarterItem(c,id) && item(id)?.droppable!==false); }
  function gearMod(c,key){ let best=0; for(const id of c?.inventory||[]){ const v=item(id)?.mods?.[key]; if(typeof v==='number') best=Math.max(best,v); else if(v===true) best=Math.max(best,1); } return best; }
  function locationById(id){ return D.locations.find(x=>x.id===id); }
  function stageInfo(day=state.day){ if(day<=20)return['初到荒岛',1]; if(day<=40)return['生存',2]; if(day<=60)return['消耗',3]; return['最后的等待',4]; }
  function save(){ if(!state)return; try{ localStorage.setItem(SAVE,JSON.stringify(state)); }catch(e){ console.warn('save failed',e); } }
  function load(){
    try{
      const x=JSON.parse(localStorage.getItem(SAVE)||'null');
      if(x&&x.version===9){
        x.rules={...DEFAULT_GAME_CONFIG.difficulty,...(x.rules||GAME_CONFIG.difficulty)};
        x.exploredLocations=x.exploredLocations||{};
        x.movedToday=!!x.movedToday;x.exploredToday=!!x.exploredToday;x.interactedTargetsToday=x.interactedTargetsToday||[];x.interactionScenesToday=x.interactionScenesToday||{};x.travelDecisionMade=!!x.travelDecisionMade;x.locationLockedToday=!!x.locationLockedToday;x.locationBrief=x.locationBrief||'';x.interaction=x.interaction||null;x.recentInteractionEvents=x.recentInteractionEvents||[];x.recentCoupleEvents=x.recentCoupleEvents||[];x.recentLocationEvents=x.recentLocationEvents||{};x.coupleId=x.coupleId||null;
        x.leaderboard=x.leaderboard||{submitted:false};
        x.camp=x.camp||{locationId:'bamboo_clearing',materials:{wood:0,fiber:0,scrap:0},buildings:{},storedFood:0,storedWater:0,lastFoodDay:0,lastWaterDay:0};
        x.shelters=x.shelters||{};x.completedExploreLocations=x.completedExploreLocations||{};x.allExploredRewarded=!!x.allExploredRewarded;x.deathAlerts=x.deathAlerts||[];x.nightInteractionLog=x.nightInteractionLog||[];x.characters.forEach(c=>{c.shelter=c.shelter||{locationId:null,level:0,facilities:[],lastMedicalDay:-99};c.aiExplored=c.aiExplored||{};});
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
  function isCouplePair(a,b){
    const p=player(); if(!p||!state.coupleId||!a||!b)return false;
    return (a.id===p.id&&b.id===state.coupleId)||(b.id===p.id&&a.id===state.coupleId);
  }
  function maybeBecomeCouple(a,b,before,after){
    const threshold=Number(rules().bondThreshold||60);if(state.coupleId||before>=threshold||after<threshold)return;
    const p=player(); if(!p)return;
    const other=a.id===p.id?b:b.id===p.id?a:null;
    if(!other||other.dead||other.sex===p.sex)return;
    state.coupleId=other.id;
    log(`${p.name}与${other.name}的关系成为“情侣”。`);
    toast(`❤ ${other.name}与你成为情侣`); sound('story');
  }
  function changeRelation(a,b,delta,reason=''){
    if(!a||!b||a.id===b.id||!delta)return;
    const k=pairKey(a.id,b.id),before=relationScore(a,b),after=clamp(before+delta,-100,100);
    state.relationships[k]=after;
    maybeBecomeCouple(a,b,before,after);
    if((a.id===state.playerId||b.id===state.playerId)&&Math.abs(after-before)>=5){
      const other=a.id===state.playerId?b:a;
      log(`${other.name}与你的关系${delta>0?'改善':'恶化'}${reason?`：${reason}`:''}`);
    }
  }
  function relationLabel(a,b){if(isCouplePair(a,b))return'情侣';const s=relationScore(a,b),bond=Number(rules().bondThreshold||60);if(s<=-50)return'敌对';if(s<=-20)return'冷淡';if(s<25)return'普通';if(s<bond)return'信任';return'生死之交';}
  function relationClass(a,b){if(isCouplePair(a,b))return'relCouple';const s=relationScore(a,b);return s<=-20?'relBad':s>=25?'relGood':'relNormal';}
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
    log(`营地建成：${b.name}`);sound('build');save();showCamp();
  }
  function campProduction(){
    const c=camp();
    if(c.buildings.water_collector&&state.day-c.lastWaterDay>=3){c.storedWater++;c.lastWaterDay=state.day;log('集水器收集到一份净水。');}
    if(c.buildings.fish_trap&&state.day-c.lastFoodDay>=4){c.storedFood++;c.lastFoodDay=state.day;log('捕鱼陷阱捕到一份食物。');}
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
    if(type==='rain'&&camp().buildings.shelter)return true;
    if(type==='heat'&&camp().buildings.water_collector)return true;
    if(type==='beast'&&camp().buildings.shelter)return true;
    return false;
  }



  function shelterOf(c){return c?.shelter||(c.shelter={locationId:null,level:0,facilities:[],lastMedicalDay:-99});}
  function shelterLevelDef(level){return (D.shelterLevels||[]).find(x=>x.level===level)||null;}
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
  function shelterProtects(c,type){
    const s=shelterOf(c);if(!s.level||s.locationId!==c.locationId)return false;
    if(type==='rain')return s.level>=1;
    if(type==='beast')return s.level>=2;
    if(type==='heat')return s.level>=2;
    return false;
  }
  function buildOwnShelter(){
    const p=player(),s=shelterOf(p);if(s.level){toast('你已经有自己的窝棚');return;}
    if(!state.travelDecisionMade){toast('先决定今天停留的地点');return;}
    const def=shelterLevelDef(1),cost=effectiveCost(p,def.cost);
    if(!canAffordMaterials(cost)){toast('公共材料不足，暂时搭不起窝棚');return;}
    payMaterials(cost);s.locationId=p.locationId;s.level=1;s.facilities=[];log(`${p.name}在${locationById(p.locationId)?.name||'这里'}搭起了自己的${def.name}。`);sound('build');save();showShelter();
  }
  function upgradeOwnShelter(){
    const p=player(),s=shelterOf(p);if(!s.level){buildOwnShelter();return;}if(s.level>=3){toast('窝棚已经升到最高等级');return;}if(p.locationId!==s.locationId){toast('要回到自己的窝棚所在地才能升级');return;}
    const next=shelterLevelDef(s.level+1),cost=effectiveCost(p,next.cost);if(!canAffordMaterials(cost)){toast('升级材料不足');return;}payMaterials(cost);s.level++;log(`${p.name}把自己的窝棚升级为${next.name}。`);sound('build');save();showShelter();
  }
  function installShelterFacility(id){
    const p=player(),s=shelterOf(p),f=(D.shelterFacilities||[]).find(x=>x.id===id);if(!f||!s.level)return;
    if(p.locationId!==s.locationId){toast('要回到自己的窝棚才能制作设施');return;}if(s.facilities.includes(id)){toast('这个设施已经有了');return;}if(s.facilities.length>=4){toast('窝棚最多只能放4件设施');return;}
    const cost=effectiveCost(p,f.cost);if(!canAffordMaterials(cost)){toast('制作设施的材料不足');return;}payMaterials(cost);s.facilities.push(id);log(`${p.name}在窝棚里制作了${f.name}。`);sound('build');save();showShelter();
  }
  function showShelter(){
    if(!state){toast('开始游戏后才能查看窝棚');return;}
    closeModal();const p=player(),s=shelterOf(p),labels={wood:'木材',fiber:'藤条',scrap:'零件'};
    if(!s.level){
      const def=shelterLevelDef(1),cost=effectiveCost(p,def.cost),txt=Object.entries(cost).map(([k,v])=>`${labels[k]}×${v}`).join(' · ');
      modal(`<div class="row between"><h2>🏠 我的窝棚</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><p class="muted">你还没有自己的窝棚。当天确定停留地点后，可以在当前位置搭建一座永久窝棚。</p><div class="shelterBuildIntro"><img src="${def.image}" class="shelterInterior" alt="简易窝棚内部"><div><b>${def.name}</b><span>${def.desc}</span><small>需要：${txt}</small></div></div><button class="btn" ${state.travelDecisionMade&&canAffordMaterials(cost)?'':'disabled'} onclick="Game.buildOwnShelter()">在${esc(locationById(p.locationId)?.name||'当前位置')}搭建窝棚</button>`);return;
    }
    const def=shelterLevelDef(s.level),here=p.locationId===s.locationId,next=s.level<3?shelterLevelDef(s.level+1):null,nextCost=next?effectiveCost(p,next.cost):null;
    const facs=(D.shelterFacilities||[]).map(f=>{const built=s.facilities.includes(f.id),cost=effectiveCost(p,f.cost),txt=Object.entries(cost).map(([k,v])=>`${labels[k]}×${v}`).join(' · ');return `<div class="shelterFacility ${built?'built':''}"><span class="facilityIcon">${f.icon}</span><div><b>${esc(f.name)}</b><small>${esc(f.desc)}</small><em>${built?'已制作':txt}</em></div>${built?'✓':`<button class="btn small" ${here&&s.facilities.length<4&&canAffordMaterials(cost)?'':'disabled'} onclick="Game.installShelterFacility('${f.id}')">制作</button>`}</div>`;}).join('');
    modal(`<div class="row between"><h2>🏠 ${esc(def.name)} · Lv.${s.level}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="shelterLocation">📍 ${esc(locationById(s.locationId)?.name||'未知地点')} ${here?'<b>· 你正在这里，可以进入内部</b>':'· 你当前不在窝棚所在地'}</div>${here?`<img src="${def.image}" class="shelterInterior" alt="${esc(def.name)}内部">`:`<div class="awayShelter">🏠 回到 ${esc(locationById(s.locationId)?.name||'窝棚所在地')} 后可进入内部、升级和制作设施。</div>`}<p class="shelterDesc">${esc(def.desc)}</p><div class="campMaterials compact"><span>🪵 ${camp().materials.wood||0}</span><span>🌿 ${camp().materials.fiber||0}</span><span>⚙️ ${camp().materials.scrap||0}</span></div>${next?`<button class="btn secondary" ${here&&canAffordMaterials(nextCost)?'':'disabled'} onclick="Game.upgradeOwnShelter()">升级为 ${esc(next.name)}<small>${Object.entries(nextCost).map(([k,v])=>` ${labels[k]}×${v}`).join('')}</small></button>`:'<div class="maxShelter">★ 已达到最高等级</div>'}<div class="section-title" style="margin-top:14px">内部设施 ${s.facilities.length}/4</div><div class="shelterFacilityList">${facs}</div>`);
  }
  function applyShelterNightBenefits(){
    for(const c of alive()){
      const s=shelterOf(c);if(!s.level||c.locationId!==s.locationId)continue;
      const baseProtect=[0,.18,.35,.52][s.level]||0;if(chance(baseProtect))c.skipDecay=true;
      if(s.facilities.includes('hammock')){c.nextCheckBonus=Math.max(c.nextCheckBonus,.08);if(chance(.28))c.skipDecay=true;}
      if(s.facilities.includes('water_filter')&&chance(.30))gainHealth(c,1);
      if(s.facilities.includes('medical_corner')&&c.life<c.maxLife&&state.day-(s.lastMedicalDay||-99)>=5&&chance(.25)){addLife(c,1);s.lastMedicalDay=state.day;log(`${c.name}在自己的窝棚医疗角恢复了1点生命。`);}
    }
  }
  function npcUseCampSupplies(c){
    if(c.dead||c.locationId!==camp().locationId)return false;let used=false;
    if(c.health<=1&&camp().storedWater>0){camp().storedWater--;gainHealth(c,1);log(`${c.name}从公共营地取用了一份净水。`);used=true;}
    if(c.health<=2&&camp().storedFood>0&&!c.inventory.some(id=>item(id)?.kind==='food')){camp().storedFood--;gainItem(c,'grilled_fish','营地领取');const food=c.inventory.find(id=>item(id)?.kind==='food'&&item(id)?.effect?.health);if(food)useNpcItem(c,food);log(`${c.name}从公共营地取用了一份食物。`);used=true;}
    return used;
  }
  function npcShelterDecision(c){
    if(c.dead)return;const s=shelterOf(c),ai=Number(c.aiLevel||3);
    // 高智能NPC会在资源充足时搭建/升级自己的窝棚，但不会无节制抢光公共材料。
    const total=(camp().materials.wood||0)+(camp().materials.fiber||0)+(camp().materials.scrap||0);if(total<7)return;
    if(!s.level&&state.day>=6&&chance(.02*ai)){const def=shelterLevelDef(1),cost=effectiveCost(c,def.cost);if(canAffordMaterials(cost)){payMaterials(cost);s.locationId=c.locationId;s.level=1;s.facilities=[];log(`${c.name}在${locationById(c.locationId)?.name||'岛上'}搭起了自己的${def.name}。`);}return;}
    if(s.level&&s.level<3&&c.locationId===s.locationId&&state.day>=12*s.level&&chance(.012*ai)){const def=shelterLevelDef(s.level+1),cost=effectiveCost(c,def.cost);if(canAffordMaterials(cost)){payMaterials(cost);s.level++;log(`${c.name}把自己的窝棚升级成了${def.name}。`);}}
    if(s.level&&s.facilities.length<4&&c.locationId===s.locationId&&chance(.01*ai)){const choices=(D.shelterFacilities||[]).filter(f=>!s.facilities.includes(f.id));if(choices.length){const f=[...choices].sort((a,b)=>NPC.itemValue({value:Object.values(b.cost).reduce((x,y)=>x+y,0)},c,state.day)-NPC.itemValue({value:Object.values(a.cost).reduce((x,y)=>x+y,0)},c,state.day))[0],cost=effectiveCost(c,f.cost);if(canAffordMaterials(cost)){payMaterials(cost);s.facilities.push(f.id);log(`${c.name}在自己的窝棚里做了${f.name}。`);}}}
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
      story:[[690,.00,.10,'sine'],[840,.08,.13,'sine'],[1040,.16,.16,'triangle']]
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
  function toggleSound(){ soundEnabled=!soundEnabled; localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0'); if(soundEnabled){unlockAudio();sound('click');} render(); }
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
    html=html.replace(/(生命(?:值)?[+＋-]\d+|健康(?:值)?[+＋-]\d+|关系(?:提升|下降|改善|恶化)|生死之交|情侣|敌对|信任)/g,'<strong class="keyState">$1</strong>');
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
    // v1.6 平衡目标：普通难度约50%通关；NPC前30/50天死亡率分别控制在20%/50%以下。
    if(key==='easy') return {...b,nightEventChance:clamp(b.nightEventChance-.10,.30,.80),baseCheckModifier:clamp(b.baseCheckModifier+.10,-.20,.30),healthDecayChance:clamp(b.healthDecayChance-.22,.45,.90),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance+.10,0,.70),startingBonusFood:clamp((b.startingBonusFood||0)+3,0,5)};
    if(key==='hard') return {...b,nightEventChance:clamp(b.nightEventChance+.08,.40,.90),baseCheckModifier:clamp(b.baseCheckModifier-.06,-.25,.20),healthDecayChance:clamp(b.healthDecayChance,0.70,1),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance-.08,0,.55),startingBonusFood:clamp(b.startingBonusFood||0,0,3)};
    return {...b,nightEventChance:b.nightEventChance,baseCheckModifier:clamp(b.baseCheckModifier,-.20,.20),healthDecayChance:clamp(b.healthDecayChance,.50,1),healthyLifeRecoverChance:clamp(b.healthyLifeRecoverChance,0,.55),startingBonusFood:clamp((b.startingBonusFood||0)+1,0,5)};
  }

  function makeChar(base){ return {...base,life:base.maxLife,health:3,inventory:[base.startItem],locationId:null,dead:false,deathDay:null,deathCause:'',healthyStreak:0,abilityCooldown:0,lowLifeSeen:false,skipDecay:false,damageShield:0,generalShield:0,nextCheckBonus:0,dayStartHealth:3,raincoatUsed:false,lifevestUsed:false,shelter:{locationId:null,level:0,facilities:[],lastMedicalDay:-99},aiExplored:{},stats:{battles:0,wins:0,trades:0,avoids:0,itemsFound:1,itemsUsed:0}}; }
  function newState(playerId,difficultyKey){
    const seed=`${Date.now()}-${Math.random()}`;
    let rs=hashSeed(seed);
    const chars=D.characters.map(makeChar);
    for(const c of chars){ const step=randStep(rs); rs=step[0]; c.locationId=D.locations[Math.floor(step[1]*D.locations.length)].id; }
    const currentRules=difficultyRules(difficultyKey);
    const crisisGen=generateCrises(rs); rs=crisisGen.rngState;
    const s={version:9,seed,rngState:rs,day:1,phase:'PREPARE',playerId,difficultyKey,difficultyLabel:DIFFICULTY_META[difficultyKey]?.label||'正常',characters:chars,rules:currentRules,relationships:{},freeTrades:{},recentPlayerEvents:[],recentNpcEvents:[],recentInteractionEvents:[],recentLocationEvents:{},currentEvent:null,eventResolved:false,currentResult:'',nightDanger:0,rescueScore:0,history:[],statistics:{battles:0,battleWins:0,trades:0,itemsUsed:0,itemsFound:0,foodUsed:0,risksTaken:0},pending:null,lastNight:null,score:null,selectedLocationId:null,exploredLocations:{},completedExploreLocations:{},movedToday:false,exploredToday:false,interactedTargetsToday:[],interactionScenesToday:{},travelDecisionMade:false,locationLockedToday:false,locationBrief:'',interaction:null,recentCoupleEvents:[],coupleId:null,leaderboard:{submitted:false},camp:{locationId:'bamboo_clearing',materials:{wood:0,fiber:0,scrap:0},buildings:{},storedFood:0,storedWater:0,lastFoodDay:0,lastWaterDay:0},allExploredRewarded:false,deathAlerts:[],nightInteractionLog:[],stories:Object.fromEntries((D.storyChains||[]).map(s=>[s.id,{started:false,step:0,nextDay:0,completed:false,branch:''}])),crises:crisisGen.crises,crisisNotice:null};
    const bonusFoods=['coconut','banana'].slice(0,currentRules.startingBonusFood||0);
    s.characters.forEach(c=>{ c.inventoryLimit=currentRules.inventoryLimit; for(const id of bonusFoods){ if(c.inventory.length<currentRules.inventoryLimit)c.inventory.push(id); } });
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
  function addLife(c,n){ const before=c.life; c.life=clamp(c.life+n,0,c.maxLife); const d=c.life-before; if(c.id===state?.playerId&&d) showStatFx('life',d); return d; }
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
    if(wouldDie&&c.id!==state?.playerId){const saveP=state.day<=30?Number(rules().npcSaveChanceDay30??.82):state.day<=50?Number(rules().npcSaveChanceDay50??.52):0;if(saveP>0&&chance(saveP)){c.life=1;c.health=Math.max(c.health,0);c.lowLifeSeen=true;log(`${c.name}在危险中勉强撑住了，没有当场死亡。`);return n;}}
    if(c.life<=1)c.lowLifeSeen=true;if(c.life<=0)kill(c,cause);return n; 
  }
  function kill(c,cause){ c.life=0;c.dead=true;c.deathDay=state.day;c.deathCause=cause;c.inventory=[];log(`${c.name}在DAY ${state.day}死亡：${cause}`);if(c.id!==state?.playerId){state.deathAlerts=state.deathAlerts||[];state.deathAlerts.push({id:c.id,name:c.name,portrait:c.portrait,day:state.day,cause});} }
  function breakItem(c,id,reason='损坏'){ if(!has(c,id)||isStarterItem(c,id))return false;if(c.id==='chenmo'&&chance(.70)){log(`${c.name}修好了${item(id).name}`);return false;}c.inventory.splice(c.inventory.indexOf(id),1);log(`${c.name}的${item(id).name}${reason}`);return true; }
  function gainItem(c,id,source='获得'){
    if(!D.items[id])return;
    if(c.inventory.includes(id)&&!item(id).consumable){if(c.id===state.playerId)toast(`已有${item(id).name}，效果不能叠加`);return;}
    if(c.inventory.length<invLimit(c)){c.inventory.push(id);c.stats.itemsFound++;if(c.id===state.playerId){state.statistics.itemsFound++;toast(`${source}：${item(id).name}`);sound('good');}return;}
    if(c.id===state.playerId){state.pending={type:'replace',incoming:id};save();render();return;}
    const candidates=discardableItems(c);if(!candidates.length)return;
    const discard=[...candidates].sort((a,b)=>NPC.itemValue(item(a),c,state.day)-NPC.itemValue(item(b),c,state.day))[0];
    if(NPC.itemValue(item(discard),c,state.day)>NPC.itemValue(item(id),c,state.day))return;
    c.inventory.splice(c.inventory.indexOf(discard),1,id);
  }
  function randomItem(filter){ if(filter)return rand(filter);const foodChance=state.day<=20?.56:state.day<=40?.52:state.day<=60?.48:.44;const x=rng();if(x<foodChance)return rand(D.foodPool);if(x<foodChance+.11)return rand(D.medicalPool);return rand(D.itemPool.filter(id=>D.items[id].kind==='gear'||D.items[id].kind==='special')); }
  function highItem(){return rand(D.itemPool.filter(id=>(item(id).value||0)>=8));}

  function useItem(c,id){
    const idx=c.inventory.indexOf(id);if(idx<0)return;const it=item(id);if(!it.consumable)return;if(id==='flare'&&state.day<61){toast('DAY 61以后再使用信号弹更有意义');return;}
    let consumed=true,msg='';
    if(it.effect?.wildFood){if(chance(.75)){addHealth(c,1);msg='野果没问题，健康+1';}else{healthDamage(c,1);msg='野果让你不舒服，健康-1';}}
    else{if(it.effect?.health){let n=it.effect.health;if(it.effect.extraHealthChance&&chance(it.effect.extraHealthChance))n++;msg=gainHealth(c,n);}if(it.effect?.life){const n=addLife(c,it.effect.life);msg=`生命+${n}`;}if(it.effect?.skipDecay){c.skipDecay=true;msg+=(msg?'，':'')+'今晚不自然下降健康';}if(it.effect?.shield){c.damageShield+=it.effect.shield;msg='下一次生命伤害将被抵消';}if(it.effect?.generalShield){c.generalShield+=it.effect.generalShield;msg='下一次健康或生命损失将被抵消';}if(it.effect?.nextCheckBonus){c.nextCheckBonus=Math.max(c.nextCheckBonus,it.effect.nextCheckBonus);msg+=(msg?'，':'')+'下一次检定更稳';}if(it.effect?.rescueScore){state.rescueScore+=it.effect.rescueScore;msg='你在高地打出信号，求救努力+2';}}
    if(c.id==='linlan'&&it.kind==='medical'){if(it.effect?.life){const extra=addLife(c,1);if(extra)msg+=(msg?'，':'')+'急救专家：生命额外+1';}if(it.effect?.shield)c.damageShield++;if(it.effect?.generalShield)c.generalShield++;}
    if(c.id==='gaoyuan'&&it.kind==='food'){if(it.effect?.health&&msg&&!msg.includes('生命')){const extra=gainHealth(c,1);msg+=(msg?'，':'')+`料理大师：${extra}`;}if(chance(.60))consumed=false;}else if(it.kind==='food'&&c.shelter?.facilities?.includes('stove')&&c.locationId===c.shelter.locationId&&it.effect?.health){const extra=gainHealth(c,1);msg+=(msg?'，':'')+`炉灶加成：${extra}`;}if(consumed)c.inventory.splice(idx,1);c.stats.itemsUsed++;if(c.id===state.playerId){state.statistics.itemsUsed++;if(it.kind==='food')state.statistics.foodUsed++;toast(`${it.name}：${msg}${consumed?'':'（没有消耗）'}`);}save();render();
  }

  function checkChance(c,stat,difficulty='normal',tags=[]){
    const base={2:.30,3:.45,4:.60,5:.75}[c[stat]]||.45;
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
    const msgs=[];if(effect.none)msgs.push('无事发生');if(effect.health){if(effect.health>0)msgs.push(gainHealth(c,effect.health));else{const n=-healthDamage(c,-effect.health);msgs.push(`健康${n}`);}}if(effect.life){if(effect.life>0){const n=addLife(c,effect.life);msgs.push(`生命+${n}`);}else{applyDamage(c,-effect.life,context);msgs.push(`生命${effect.life}`);}}if(effect.skipDecay){c.skipDecay=true;msgs.push('今晚不自然下降健康');}if(effect.nextCheckBonus){c.nextCheckBonus=Math.max(c.nextCheckBonus,effect.nextCheckBonus);msgs.push('获得下一次检定加成');}if(effect.item){gainItem(c,effect.item);msgs.push(`获得${item(effect.item).name}`);}if(effect.randomItem){const id=randomItem();gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomHighItem){const id=highItem();gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomFood){const id=randomItem(D.foodPool);gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomFrom){const id=rand(effect.randomFrom);gainItem(c,id);msgs.push(`获得${item(id).name}`);}if(effect.randomItemChance){if(chance(effect.randomItemChance)){const id=randomItem();gainItem(c,id);msgs.push(`获得${item(id).name}`);}else msgs.push('里面什么也没有');}
    if(effect.pickItems){const choices=[];while(choices.length<effect.pickItems){const id=randomItem();if(!choices.includes(id))choices.push(id);}if(c.id===state.playerId){state.pending={type:'pick',choices};msgs.push(`发现${effect.pickItems}件物资，可选择1件`);}else{const id=[...choices].sort((a,b)=>NPC.itemValue(item(b),c,state.day)-NPC.itemValue(item(a),c,state.day))[0];gainItem(c,id);msgs.push(`获得${item(id).name}`);}}
    if(effect.loseItem){const lost=loseRandomItem(c);msgs.push(lost?`失去${item(lost).name}`:'没有丢失任何道具');}if(effect.loseFood){const foods=c.inventory.filter(id=>item(id).kind==='food');if(foods.length){if(c.shelter?.facilities?.includes('drying_rack')&&c.locationId===c.shelter.locationId){msgs.push('干燥架保护了食物，没有发生腐坏');}else{const id=rand(foods);c.inventory.splice(c.inventory.indexOf(id),1);msgs.push(`${item(id).name}腐坏了`);}}else msgs.push('你没有食物可坏');}if(effect.achievement)unlock(effect.achievement);if(effect.rescueScore){state.rescueScore+=effect.rescueScore;msgs.push('求救努力有所增加');}if(effect.nightDanger){state.nightDanger+=effect.nightDanger;msgs.push('今晚危险似乎增加了');}if(effect.fromNpc){const donor=alive().filter(x=>x.id!==c.id&&tradableItems(x).length);if(donor.length){const d=rand(donor),pool=tradableItems(d),iid=[...pool].sort((a,b)=>NPC.itemValue(D.items[a],d,state.day)-NPC.itemValue(D.items[b],d,state.day))[0];d.inventory.splice(d.inventory.indexOf(iid),1);gainItem(c,iid);msgs.push(`${d.name}留下了${item(iid).name}`);}else msgs.push('最后什么也没找到');}if(effect.campMaterial){addCampMaterial(effect.campMaterial);msgs.push('获得营地建设材料');}if(effect.relationTo){const o=cBy(effect.relationTo);if(o){changeRelation(c,o,effect.relation||0,'剧情选择');msgs.push(`与${o.name}关系${(effect.relation||0)>0?'提升':'下降'}`);}}if(effect.relationRandom){const o=randomOther(c);if(o){changeRelation(c,o,effect.relationRandom,'剧情选择');msgs.push(`与${o.name}关系变化`);}}if(effect.relationAll){for(const o of alive().filter(x=>x.id!==c.id))changeRelation(c,o,effect.relationAll,'共同经历');msgs.push('与其他幸存者的关系有所改善');}return msgs.join('；');
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
    const c=player(),e=state.currentEvent;if(!e||state.eventResolved)return;let result='';if(e.type==='instant')result=applyEffect(c,e.effect,e.name);else if(e.type==='hazard')result=e.hazard==='beast'?beastHazard(c):rainHazard(c);else if(e.type==='check'){const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]);result=ok?`检定成功。${applyEffect(c,e.success,e.name)}`:`检定失败。${applyEffect(c,e.fail,e.name)}`;}else if(e.type==='choice'){const ch=e.choices[index];result=resolveChoice(c,e,ch,false);advanceStory(e,ch);}const materialMsg=gatherCampMaterial(state.selectedLocationId);if(materialMsg)result+=(result?'；':'')+materialMsg;state.completedExploreLocations=state.completedExploreLocations||{};state.completedExploreLocations[state.selectedLocationId]=true;const exploreReward=checkAllExploredReward();if(exploreReward)result+=(result?'；':'')+`全岛探索完成奖励：${exploreReward}`;state.eventResolved=true;state.phase='POST';state.currentResult=result||'无事发生';if(c.dead){endGame(false);return;}save();render();
  }
  function resolveChoice(c,e,ch,isNpc){
    if(!ch)return '无事发生';if(ch.risk==='危险'&&c.id===state.playerId)state.statistics.risksTaken++;if(ch.action==='none')return '你选择不冒险。';if(ch.action==='effect')return applyEffect(c,ch.effect||{},e.name)||'无事发生';if(ch.action==='check'){const ok=checkChance(c,ch.stat,ch.difficulty,ch.tags||e.tags||[]);if(ok)return `检定成功。${applyEffect(c,ch.success,e.name)}`;const f=ch.fail||{};if(f.chance&&!chance(f.chance))return '检定失败，但没有造成进一步损失。';if(f.beast)return `检定失败。${beastHazard(c)}`;return `检定失败。${applyEffect(c,f,e.name)}`;}if(ch.action==='randomFood'){const r=rng();if(r<.6){addHealth(c,1);return '味道古怪，但健康+1';}if(r<.85)return '你等了一会儿，似乎没事。';healthDamage(c,1);return '胃开始翻腾，健康-1';}if(ch.action==='gambleFood'){const r=rng();if(r<.55){addHealth(c,1);return '勉强能吃，健康+1';}if(r<.8)return '没有明显效果。';applyDamage(c,1,'食物中毒');return '情况比想象糟，生命-1';}if(ch.action==='mushroom'){const r=rng();if(r<.5){addHealth(c,2);return '居然能吃，健康+2';}if(r<.8)return '没有明显效果。';applyDamage(c,1,'误食有毒蘑菇');return '你很快意识到判断错了，生命-1';}return '无事发生';
  }

  function enemy(a,b){return relationScore(a,b)<=-50;}
  function makeEnemy(a,b){state.relationships[pairKey(a.id,b.id)]=-80;}
  function combatPower(c){let weaponBonus=0;if(has(c,'dagger')||has(c,'spear'))weaponBonus=1;return c.str+c.agi+weaponBonus+(c.id==='zhouye'?2:0);}
  function fight(a,b){
    makeEnemy(a,b);changeRelation(a,b,-25,'发生战斗');a.stats.battles++;b.stats.battles++;if(a.id===state.playerId||b.id===state.playerId)state.statistics.battles++;
    const diff=combatPower(a)-combatPower(b);const p=diff>=3?1:diff===2?.9:diff===1?.7:diff===0?.5:diff===-1?.3:diff===-2?.1:0;
    const winA=chance(p),w=winA?a:b,l=winA?b:a;w.stats.wins++;if(w.id===state.playerId)state.statistics.battleWins++;
    let loot='';const pool=lootableItems(l);if(pool.length){const id=rand(pool);l.inventory.splice(l.inventory.indexOf(id),1);gainItem(w,id,'战利品');loot=`，获得${item(id).name}`;}
    applyDamage(l,1,'与幸存者战斗');return `${w.name}占了上风${loot}；${l.name}生命-1。`;
  }
  function trade(a,b,playerGiveId=null){
    if(relationScore(a,b)<25)return '关系还没有达到“信任”，对方不愿交换物资。';
    const aa=tradableItems(a),bb=tradableItems(b);if(!aa.length)return `${a.name}没有可交易道具。`;if(!bb.length)return `${b.name}没有可交易道具。`;
    let giveA=a.id===state.playerId?playerGiveId:null;if(!giveA||!aa.includes(giveA))giveA=[...aa].sort((x,y)=>NPC.itemValue(item(x),a,state.day)-NPC.itemValue(item(y),a,state.day))[0];
    const giveB=[...bb].sort((x,y)=>NPC.itemValue(item(x),b,state.day)-NPC.itemValue(item(y),b,state.day))[0];
    if(!giveA||!giveB)return '没有合适的交换物品。';
    a.inventory.splice(a.inventory.indexOf(giveA),1);b.inventory.splice(b.inventory.indexOf(giveB),1);a.inventory.push(giveB);b.inventory.push(giveA);
    a.stats.trades++;b.stats.trades++;changeRelation(a,b,6,'完成交易');sound('trade');if(a.id===state.playerId||b.id===state.playerId)state.statistics.trades++;
    return `${a.name}交出${item(giveA).name}，${b.name}拿出${item(giveB).name}作为交换。`;
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
    return `${arrival?'你来到':'清晨，你仍在'}${loc.name}。${base} ${extra}`;
  }
  function triggerHostileLocationBattle(){
    const p=player(),key=`${state.day}|${p.locationId}`;if(state.hostileCheckedKey===key)return false;state.hostileCheckedKey=key;
    const hostiles=locationPeers().filter(o=>enemy(p,o));if(!hostiles.length||!chance(Number(rules().hostileBattleChance??.20)))return false;
    const o=rand(hostiles),result=fight(p,o);state.hostileIncident={targetId:o.id,result};state.phase='POST_ACTION';state.currentResult=`你刚在${locationById(p.locationId)?.name||'这里'}站稳，${o.name}就和你发生了冲突。${result}`;log(`敌对相遇：你与${o.name}发生战斗。`);sound('battle');if(p.dead){endGame(false);return true;}return true;
  }
  function setLocationPhase(arrival=false){state.locationBrief=makeLocationBrief(player().locationId,arrival);state.phase='LOCATION';state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.interaction=null;if(!triggerHostileLocationBattle()){save();render();}else{save();render();}}
  function relationBucket(a,b){const s=relationScore(a,b),bond=Number(rules().bondThreshold||60);if(s<=-50)return'enemy';if(s<=-20)return'cold';if(s<25)return'normal';if(s<bond)return'trust';return'bond';}
  function buildInteractionScene(o){
    const p=player(),prof=D.interactionProfiles?.[o.id],bucket=relationBucket(p,o),loc=p.locationId,rel=relationScore(p,o);
    const recent=state.recentInteractionEvents||(state.recentInteractionEvents=[]),recentLimit=Math.max(4,Number(rules().interactionRecentWindow||18));
    if(isCouplePair(p,o)&&D.coupleInteractionEvents?.length){
      const rc=state.recentCoupleEvents||(state.recentCoupleEvents=[]);
      let cp=D.coupleInteractionEvents.filter(e=>!rc.includes(e.id));if(!cp.length){rc.length=0;cp=[...D.coupleInteractionEvents];}
      if(chance(.72)){const e=rand(cp);rc.push(e.id);if(rc.length>5)rc.shift();return {id:e.id,title:`❤ ${e.name}`,text:String(e.text||'').split('{name}').join(o.name).split('{place}').join(locationById(loc)?.name||'这里'),choices:e.choices||[],couple:true};}
    }
    let extras=(D.interactionEvents||[]).filter(e=>(e.minRelation==null||rel>=e.minRelation)&&(e.maxRelation==null||rel<=e.maxRelation)&&(!e.locations||e.locations.includes(loc))&&!recent.includes(e.id));
    if(!extras.length)extras=(D.interactionEvents||[]).filter(e=>(e.minRelation==null||rel>=e.minRelation)&&(e.maxRelation==null||rel<=e.maxRelation)&&(!e.locations||e.locations.includes(loc)));
    const personalId=`profile_${o.id}_${bucket}_${loc}`;
    extras.sort((a,b)=>((a.maxRelation??100)-(a.minRelation??-100))-((b.maxRelation??100)-(b.minRelation??-100)));if(extras.length>18)extras=extras.slice(0,18);
    const useExtra=extras.length&&(recent.includes(personalId)||chance(.84));
    if(useExtra){const e=rand(extras);recent.push(e.id);if(recent.length>recentLimit)recent.shift();return {id:e.id,title:e.name,text:String(e.text||'').split('{name}').join(o.name).split('{place}').join(locationById(loc)?.name||'这里'),choices:e.choices||[]};}
    const base=prof?.lines?.[bucket]||`${o.name}看了你一眼。`;
    const local=prof?.location?.[loc]||`你们在${locationById(loc)?.name||'这里'}碰面。`;
    recent.push(personalId);if(recent.length>recentLimit)recent.shift();
    return {id:personalId,title:'简单交谈',text:`${local}
${base}`,choices:prof?.choices||[]};
  }
  function beginInteraction(targetId){
    if(!['LOCATION','POST','POST_ACTION'].includes(state.phase))return;
    if(targetInteracted(targetId)){toast('今天已经与这个人物互动过一次');return;}
    const p=player(),o=cBy(targetId);if(!o||o.dead||o.locationId!==p.locationId)return;
    state.locationLockedToday=true;const cache=state.interactionScenesToday||(state.interactionScenesToday={});if(!cache[targetId])cache[targetId]=buildInteractionScene(o);state.interaction={targetId,scene:cache[targetId]};state.phase='INTERACTION';sound('encounter');save();render();
  }
  function interactionChoice(index){
    const it=state.interaction,p=player(),o=cBy(it?.targetId),ch=it?.scene?.choices?.[index];if(!it||!o||!ch)return;
    let result='';
    if(ch.kind==='check'){
      const ok=checkChance(p,ch.stat,ch.difficulty||'normal',ch.tags||[]);
      if(ok){changeRelation(p,o,ch.goodRelation||0,'一起做了点事');result=`${ch.text}：顺利完成。${applyEffect(p,ch.reward||{},'人物互动')}`;}
      else{changeRelation(p,o,ch.badRelation||0,'事情没办成');result=`${ch.text}：没有想象中顺利。`;}
    }else{changeRelation(p,o,ch.relation||0,'交谈');result=`${ch.text}。${applyEffect(p,ch.reward||{},'人物互动')}`;}
    markInteracted(o.id);state.currentResult=result||'你们简单聊了几句。';state.phase='POST_ACTION';log(`你与${o.name}在${locationById(p.locationId)?.name||'岛上'}完成了今天的人物互动。`);save();render();
  }
  function interactionTradeModal(){
    const p=player(),o=cBy(state.interaction?.targetId);if(!o)return;
    if(relationScore(p,o)<25){toast('只有“信任”及以上关系才能交易');return;}
    const mine=tradableItems(p),theirs=tradableItems(o);if(!mine.length){toast('你没有可交易的道具');return;}if(!theirs.length){toast(`${o.name}没有可交易的道具`);return;}
    modal(`<h2>与${esc(o.name)}交易</h2><p class="muted">你只能选择自己拿出的道具。对方会自己决定拿什么交换，专属初始道具永远不能交易。</p>${mine.map(id=>`<button class="choice" onclick="Game.interactionTradeChoose('${id}')">拿出 ${item(id).ico} <b class="itemName">${esc(item(id).name)}</b></button>`).join('')}<button class="btn ghost" onclick="Game.closeModal()">取消</button>`);
  }
  function interactionTradeChoose(id){
    closeModal();const p=player(),o=cBy(state.interaction?.targetId);if(!o)return;const result=trade(p,o,id);markInteracted(o.id);state.currentResult=result;state.phase='POST_ACTION';log(`你与${o.name}进行了交易。`);save();render();
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
      ()=>{for(const o of alive().filter(x=>x.id!==p.id))changeRelation(p,o,5,'完成全岛探索');return '与所有幸存者关系+5';},
      ()=>{p.nextCheckBonus=Math.max(p.nextCheckBonus,.20);return '下一次属性检定获得大幅加成';}
    ];
    let idx=Math.floor(rng()*rewards.length);if(idx===1&&p.life>=p.maxLife){state.rescueScore+=2;idx=2;}const text=rewards[idx]();state.exploreRewardText=text;log(`探索完全部12个地点：${text}`);sound('story');toast(`★ 全岛探索完成：${text}`);return text;
  }
  function moveToLocation(locationId){
    if(state.phase!=='MAP'||state.travelDecisionMade)return;const loc=locationById(locationId);if(!loc)return;const p=player();
    state.travelDecisionMade=true;state.locationLockedToday=true;
    if(p.locationId!==locationId){const first=!state.exploredLocations[locationId];p.locationId=locationId;state.movedToday=true;state.exploredLocations[locationId]=true;if(first&&p.id==='suqing'&&chance(.35)){const found=randomItem();gainItem(p,found,'自然感知');log(`苏晴首次抵达${loc.name}，凭观察发现了${item(found).name}。`);}log(`你前往${loc.name}，今天会留在这里。`);sound('move');setLocationPhase(true);}
    else{setLocationPhase(false);}
  }
  function openMap(){
    if(state.travelDecisionMade){toast('今天已经决定了停留地点');return;}
    if(!['MORNING','MAP'].includes(state.phase))return;state.phase='MAP';save();render();
  }
  function chooseStay(){if(state.phase!=='MORNING'||state.travelDecisionMade)return;state.travelDecisionMade=true;state.locationLockedToday=true;log(`你决定今天留在${locationById(player().locationId)?.name||'当前地点'}。`);setLocationPhase(false);}

  function morningRelationshipSupport(){
    const p=player();const friends=alive().filter(c=>c.id!==p.id&&c.locationId===p.locationId&&relationScore(p,c)>=35).sort((a,b)=>relationScore(p,b)-relationScore(p,a));if(!friends.length)return;
    const f=friends[0];if(p.health<=1&&chance(.22)){const food=tradableItems(f).find(id=>item(id).kind==='food');if(food){f.inventory.splice(f.inventory.indexOf(food),1);addHealth(p,1);changeRelation(p,f,3,'互相照顾');log(`${f.name}清晨分给你一点食物。`);}}
  }
  function startDay(showFx=true){
    const p=player();state.characters.forEach(c=>{if(c.abilityCooldown>0)c.abilityCooldown--;if(!c.dead&&c.id==='linlan'&&c.life<c.maxLife&&c.abilityCooldown<=0&&chance(.60)){addLife(c,1);c.abilityCooldown=3;log(`${c.name}的急救专家触发，生命+1`);if(c.id===state.playerId)toast('急救专家：生命+1');}if(!c.dead)c.dayStartHealth=c.health;});
    state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.nightDanger=0;state.selectedLocationId=null;state.movedToday=false;state.exploredToday=false;state.interactedTargetsToday=[];state.interactionScenesToday={};state.travelDecisionMade=false;state.locationLockedToday=false;state.interaction=null;
    campProduction();updateCrisisNotice();morningRelationshipSupport();processNpcMorningGroups(p.locationId);state.locationBrief=makeLocationBrief(p.locationId,false);state.phase='MORNING';save();render();if(showFx)setTimeout(showDayTransition,40);
  }
  function npcUseNeeds(c){if(c.dead)return;if(c.life<c.maxLife){const heal=c.inventory.find(id=>['first_aid','bandage','apple'].includes(id));if(heal)useNpcItem(c,heal);}if(NPC.shouldUseFood(c)){const food=c.inventory.find(id=>item(id).kind==='food'&&(item(id).effect?.health||item(id).effect?.wildFood));if(food)useNpcItem(c,food);}}
  function useNpcItem(c,id){const it=item(id),idx=c.inventory.indexOf(id);if(idx<0||!it.consumable)return;if(it.effect?.health)addHealth(c,it.effect.health);if(it.effect?.life){addLife(c,it.effect.life);if(c.id==='linlan'&&it.kind==='medical')addLife(c,1);}if(it.effect?.skipDecay)c.skipDecay=true;if(it.effect?.shield)c.damageShield++;if(it.effect?.generalShield)c.generalShield++;if(it.effect?.nextCheckBonus)c.nextCheckBonus=Math.max(c.nextCheckBonus,it.effect.nextCheckBonus);if(it.effect?.wildFood){if(chance(.75))addHealth(c,1);else healthDamage(c,1);}let consume=true;if(c.id==='gaoyuan'&&it.kind==='food'){if(it.effect?.health)gainHealth(c,1);if(chance(.60))consume=false;}if(consume)c.inventory.splice(idx,1);}
  function chooseNpcDestination(c){
    const ai=Number(c.aiLevel||3),own=shelterOf(c),hasFood=c.inventory.some(id=>item(id)?.kind==='food'),p=player();let best=c.locationId,bestScore=-999;
    for(const loc of D.locations){
      let score=loc.id===c.locationId?1.2:0;
      if(c.health<=1){if(loc.id==='fresh_stream')score+=7;if(loc.id===camp().locationId&&(camp().storedFood>0||camp().storedWater>0))score+=10;if(own.level&&loc.id===own.locationId)score+=6;}if(!hasFood&&camp().storedFood>0&&loc.id===camp().locationId)score+=7;
      if(c.life<=2){if(loc.id==='wreck_cabin'||loc.id==='crash_beach')score+=3;if(own.level&&loc.id===own.locationId)score+=4;}
      if(!hasFood&&['coconut_grove','moon_bay','reef_pools','fresh_stream'].includes(loc.id))score+=4;
      if(own.level&&state.day%4===0&&loc.id===own.locationId)score+=2;
      if(relationScore(c,p)>=25&&loc.id===p.locationId)score+=1.5;
      if(c.health<=1&&['swamp_edge','cliff_edge'].includes(loc.id))score-=4;
      if(!c.aiExplored?.[loc.id])score+=1.3;
      score += rng()*(7-ai); // 智能越高，随机噪声越小。
      if(score>bestScore){bestScore=score;best=loc.id;}
    }
    return best;
  }
  function npcTurn(c){
    if(c.dead)return;npcUseNeeds(c);c.locationId=chooseNpcDestination(c);c.aiExplored=c.aiExplored||{};c.aiExplored[c.locationId]=true;npcUseCampSupplies(c);
    const e=chooseLocationEvent(c.locationId,true);if(e.type==='instant')applyEffect(c,e.effect,e.name);else if(e.type==='hazard'){if(e.hazard==='beast')beastHazard(c);else rainHazard(c);}else if(e.type==='check'){const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]);applyEffect(c,ok?e.success:e.fail,e.name);}else if(e.type==='choice'){const ix=NPC.eventChoice(c,e,D,rng);resolveChoice(c,e,e.choices[ix],true);}npcUseNeeds(c);npcUseCampSupplies(c);npcShelterDecision(c);
  }


  function nightInteractionProbability(a,b){
    const rel=relationScore(a,b),closeness=clamp((rel+100)/200,0,1);
    return clamp(.40+closeness*.40,.40,.80);
  }
  function runNightInteractions(){
    const groups={};for(const c of alive())(groups[c.locationId]||(groups[c.locationId]=[])).push(c);
    const notes=[];state.nightInteractionLog=[];
    for(const [locId,list] of Object.entries(groups)){
      if(list.length<2)continue;
      const pairs=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)pairs.push([list[i],list[j]]);
      shuffle(pairs);let shown=0;
      for(const [a,b] of pairs){
        if(shown>=2)break;const prob=nightInteractionProbability(a,b);if(!chance(prob))continue;
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
    if(ef.allHazard==='rain')affected.forEach(c=>extra.push(`${c.name}：${rainHazard(c)}`));if(ef.randomHazard==='beast'&&affected.length){const c=rand(affected);extra.push(`${c.name}：${beastHazard(c)}`);}if(ef.weakHealth)affected.filter(c=>c.health<=1).forEach(c=>{healthDamage(c,1);extra.push(`${c.name}健康-1`);});if(ef.randomLoseItem&&affected.length){const c=rand(affected),id=loseRandomItem(c);if(id)extra.push(`${c.name}失去${item(id).name}`);}if(ef.randomHealthDamage)affected.forEach(c=>{if(chance(ef.randomHealthDamage)){healthDamage(c,1);extra.push(`${c.name}健康-1`);}});if(ef.randomHealth&&affected.length){const pool=n.id==='insects'?affected.filter(c=>!gearMod(c,'insectSafe')):affected;if(pool.length){const c=rand(pool);if(ef.randomHealth>0)addHealth(c,ef.randomHealth);else healthDamage(c,-ef.randomHealth);extra.push(`${c.name}健康${ef.randomHealth>0?'+':''}${ef.randomHealth}`);}}if(ef.lowestHealth&&affected.length){const min=Math.min(...affected.map(c=>c.health));const c=rand(affected.filter(x=>x.health===min));addHealth(c,ef.lowestHealth);extra.push(`${c.name}健康+1`);}if(ef.allChanceHealth)affected.forEach(c=>{if(chance(ef.allChanceHealth)){healthDamage(c,1);extra.push(`${c.name}健康-1`);}});if(ef.randomItem&&affected.length){const c=rand(affected),id=randomItem();gainItem(c,id);extra.push(`${c.name}获得${item(id).name}`);}if(ef.nextCheckBonus)affected.forEach(c=>c.nextCheckBonus=Math.max(c.nextCheckBonus,ef.nextCheckBonus));if(ef.protectWeak)affected.filter(c=>c.health<=1).forEach(c=>c.skipDecay=true);if(ef.rescueScore)state.rescueScore+=ef.rescueScore;if(ef.relationDown&&affected.length>=2){const [a,b]=shuffle([...affected]).slice(0,2);changeRelation(a,b,-10,'夜间争吵');extra.push(`${a.name}和${b.name}之间的气氛变差了`);}if(ef.theft&&affected.length>=2&&chance(.28)){const [a,b]=shuffle([...affected]).slice(0,2),pool=lootableItems(b);if(pool.length&&a.inventory.length<invLimit(a)){const id=rand(pool);b.inventory.splice(b.inventory.indexOf(id),1);a.inventory.push(id);changeRelation(a,b,-20,'夜间失窃');extra.push(`${a.name}拿走了${b.name}的${item(id).name}`);}}
    const locName=targetLocationId?locationById(targetLocationId)?.name:null;return {title:locName?`${locName} · ${n.name}`:n.name,text:n.text+(extra.length?'\n'+extra.join('；'):''),locationId:targetLocationId};
  }
  function settleDay(){for(const c of alive()){const beganZero=c.dayStartHealth===0;if(beganZero&&c.health===0)applyDamage(c,1,'长期缺乏食物');else if(c.health>0&&!c.skipDecay){let decay=Number(rules().healthDecayChance)??1;if(c.locationId===camp().locationId&&camp().buildings.water_collector)decay=Math.max(.35,decay-.10);if(chance(decay))healthDamage(c,1);}c.skipDecay=false;if(c.dead)continue;if(c.health>=2)c.healthyStreak++;else c.healthyStreak=0;if(c.healthyStreak>=3){if(chance(Number(rules().healthyLifeRecoverChance)??.20))addLife(c,1);c.healthyStreak=0;}}state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.selectedLocationId=null;}
  function endDay(){const p=player();if(p.dead)return;state.characters.filter(c=>!c.dead&&c.id!==state.playerId).forEach(npcTurn);applyShelterNightBenefits();const report=runCrisis()||runNight();const social=runNightInteractions();if(social.length)report.text+=(report.text?'\n':'')+'夜间相处：'+social.join('；');settleDay();if(p.dead){endGame(false);return;}if(state.day>=80){state.day=81;endGame(true);return;}state.lastNight=report;state.phase='NIGHT_REPORT';sound('night');save();render();}
  function nextDay(){state.day++;state.lastNight=null;startDay(true);}

  function unlock(id){let list=[];try{list=JSON.parse(localStorage.getItem(ACH)||'[]');}catch(e){}if(!list.includes(id)){list.push(id);localStorage.setItem(ACH,JSON.stringify(list));}}
  function endGame(win){const p=player();state.phase=win?'VICTORY':'GAME_OVER';if(win){unlock('day81');if(alive().length===6)unlock('all_alive');if(state.statistics.battles===0)unlock('pacifist');if(state.statistics.battles>=5)unlock('island_boss');}const survived=win?81:Math.max(1,state.day);let score=Math.round((survived/81)*50)+(win?20:0);score+=Math.round(10*((p.life/p.maxLife)*.7+(p.health/3)*.3));score+=Math.min(8,Math.round((p.inventory.filter(id=>!isStarterItem(p,id)).reduce((s,id)=>s+(item(id).value||0),0)/32)*8));score+=Math.max(0,Math.min(7,Math.round(state.statistics.trades*1.5-state.statistics.battles*.6+3)));score+=Math.min(5,Math.round(state.rescueScore));state.score=clamp(Math.round(score),0,100);state.leaderboard=state.leaderboard||{submitted:false};save();render();}
  function rating(score){if(score>=95)return['荒岛传奇','贝爷看了你的生存记录，决定先回去补补课。'];if(score>=85)return['生存大师','你不是在荒岛求生，你像是在这里短期驻场。'];if(score>=70)return['靠谱幸存者','虽然狼狈，但救援船最终看到的是一个还能自己走上船的人。'];if(score>=55)return['命够硬','有些时候你靠策略，有些时候你纯粹靠命。'];if(score>=40)return['岛上老油条','能活这么久，已经不能完全用运气解释。'];if(score>=20)return['生存体验卡','你大概已经知道，下次什么东西不能乱吃了。'];return['三日游游客','无人岛甚至还没来得及记住你的名字。'];}

  function riskHint(ch){const p=player();if(p.id==='suqing')return ch.risk?`风险：${ch.risk}`:'';if(has(p,'binoculars')&&ch.risk==='危险')return '这里似乎有危险……';return ch.stat?`${{str:'力量',agi:'敏捷',int:'知识',luck:'幸运'}[ch.stat]||''}检定`:'';}
  function hearts(c){return '❤️'.repeat(Math.max(0,c.life))+'♡'.repeat(Math.max(0,c.maxLife-c.life));}
  function healthDots(c){return '●'.repeat(c.health)+'○'.repeat(3-c.health);}
  function invHtml(c,interactive=true){let h='';for(let i=0;i<invLimit(c);i++){const id=c.inventory[i];if(!id){h+=`<div class="slot empty"><div class="ico">＋</div><div class="label">空位</div></div>`;continue;}const it=item(id),starter=isStarterItem(c,id);h+=`<button class="slot ${starter?'starterSlot':''}" ${interactive?`onclick="Game.itemInfo('${id}')"`:''}><div class="ico">${it.ico}</div><div class="label">${esc(it.name)}</div>${starter?'<span class="starterBadge">专属</span>':''}</button>`;}return h;}
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
    const terrain=`<svg class="mapTerrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="river" d="M53 12 C50 25 45 29 44 43 C43 55 52 61 47 76"/>
      <path class="trail" d="M18 60 C27 55 31 42 42 43 C53 44 61 34 75 24"/>
      <path class="trail alt" d="M28 72 C40 66 48 60 66 65 C75 66 80 55 82 46"/>
      <ellipse class="sandPatch" cx="16" cy="59" rx="8" ry="5"/><ellipse class="sandPatch" cx="68" cy="66" rx="10" ry="6"/>
      <circle class="pond" cx="39" cy="77" r="5"/><circle class="pond tiny" cx="82" cy="46" r="3"/>
    </svg>`;
    const details=`<div class="terrainIcon mountain m1">⛰️</div><div class="terrainIcon mountain m2">⛰️</div><div class="terrainIcon palm p1">🌴</div><div class="terrainIcon palm p2">🌴</div><div class="terrainIcon trees t1">🌳</div><div class="terrainIcon trees t2">🌳</div><div class="terrainIcon plane">✈️</div><div class="terrainIcon campMark">⛺</div><div class="terrainIcon rocks">🪨</div><div class="waveLine w1">≈≈≈</div><div class="waveLine w2">≈≈</div><div class="cloudShade c1"></div><div class="cloudShade c2"></div>`;
    return `<section class="card islandCard"><div class="row between"><div><div class="section-title">海岛地图</div><div class="name" style="font-size:18px">选择今天要去的地点</div></div><div class="meta">已探索 ${exploredCount}/12</div></div><div class="islandMap"><div class="islandSea"></div><div class="islandBody"></div>${terrain}${details}${D.locations.map(loc=>{const known=state.exploredLocations?.[loc.id],current=p.locationId===loc.id,label=known?loc.name:'未知',storyHere=story?.ready&&story.step.location===loc.id,campHere=loc.id===camp().locationId&&Object.keys(camp().buildings||{}).length;return `<button class="mapSpot ${known?'known':''} ${current?'current':''} ${storyHere?'storySpot':''}" style="left:${loc.x}%;top:${loc.y}%" onclick="Game.move('${loc.id}')"><span class="pin">${current?'🧍':storyHere?'📖':campHere?'🏕️':known?loc.icon:'❓'}</span><span class="spotLabel">${esc(label)}${current?' · 当前':''}${storyHere?' · 剧情':''}</span></button>`;}).join('')}</div><div class="mapLegend">岛上的溪流、山脊、林地、沙滩和营地现在会更直观地显示。每天清晨先决定留在当前地点还是前往别处；一旦作出选择，今天就不能再改变停留地点。</div><button class="btn ghost" style="margin-top:10px" onclick="Game.backLocation()">返回上一页</button></section>`;
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
    const peers=locationPeers();
    return `<section class="scenePanel"><div class="sceneHead"><div><div class="section-title">当前地点</div><div class="sceneName">${esc(loc?.name||'未知地点')}</div></div><span class="sceneCount">${peers.length?`同地点 ${peers.length} 人`:'独自一人'}</span></div><div class="sceneImageWrap"><img class="sceneImage" src="${esc(loc?.scene||'')}" alt="${esc(loc?.name||'地点')}场景" loading="eager"><div class="sceneShade"></div>${peers.length?`<div class="scenePeople"><div class="scenePeopleTitle">这里的其他幸存者</div><div class="scenePeopleRow">${peers.map(c=>`<button class="scenePerson" onclick="Game.personInfo('${c.id}')">${portrait(c,'sceneAvatar')}<span>${esc(c.name)}</span></button>`).join('')}</div></div>`:''}</div>${brief?`<div class="sceneBrief">${richText(brief)}</div>`:''}</section>`;
  }
  function availableActionsHtml(){
    const p=player(),peers=locationPeers(),done=(state.interactedTargetsToday||[]),remaining=peers.filter(c=>!done.includes(c.id)),s=shelterOf(p),hereShelter=s.level&&s.locationId===p.locationId;
    const interactionChips=peers.length?`<div class="actionPeople">${peers.map(c=>`<button class="actionPerson ${targetInteracted(c.id)?'done':''}" ${targetInteracted(c.id)?'disabled':''} onclick="Game.interact('${c.id}')">${portrait(c,'meetPortrait')}<span>${esc(c.name)}</span><small>${targetInteracted(c.id)?'已互动':relationLabel(p,c)}</small></button>`).join('')}</div>`:'';
    return `<section class="card actionHub compactHub"><div class="actionHubHead"><b>今日行动</b><span>探索 ${state.exploredToday?'✓':'0/1'} · 互动 ${done.length}/${peers.length}</span></div>${interactionChips}<div class="compactActions">${!state.exploredToday?`<button class="quickAction explore" onclick="Game.exploreHere()">🔎<span>探索</span></button><button class="quickAction rest" onclick="Game.restHere()">🛏️<span>休整</span></button>`:''}<button class="quickAction shelter" onclick="Game.showShelter()">🏠<span>${hereShelter?'进入窝棚':s.level?'查看窝棚':'搭窝棚'}</span></button><button class="quickAction end" onclick="Game.endDay()">🌙<span>结束今天</span></button></div>${remaining.length?`<div class="actionHint">还可以与 ${remaining.map(c=>esc(c.name)).join('、')} 互动</div>`:''}</section>`;
  }
  function personInfo(id){
    const c=cBy(id),p=player();if(!c)return;const rel=c.id===p.id?'主角':`${relationLabel(p,c)} · ${relationScore(p,c)>0?'+':''}${relationScore(p,c)}`;
    modal(`<div class="row between"><h2>${esc(c.name)}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="personInfoHero">${portrait(c,'personInfoPortrait')}<div><b>${esc(c.job)}</b><div class="meta">${esc(c.sex)} · ${c.age}岁</div><div class="relationText ${c.id===p.id?'':relationClass(p,c)}">${esc(rel)}</div></div></div><div class="personInfoStats"><span>生命 ${hearts(c)}</span><span>健康 ${healthDots(c)}</span><span>力量 ${c.str}</span><span>敏捷 ${c.agi}</span><span>知识 ${c.int}</span><span>幸运 ${c.luck}</span></div><p class="personAbility">${esc(c.ability||'')}</p><div class="meta">当前位置：${esc(locationById(c.locationId)?.name||'未知')} · 背包 ${c.inventory.length}/${invLimit(c)}</div><div class="personAi">${c.id===p.id?'由玩家控制':`AI智能水平：<b>${esc(c.aiLabel||'中等')}</b> · 会主动寻找食物/水、使用公共营地物资并建设自己的窝棚`}</div>${c.shelter?.level?`<div class="meta">🏠 ${esc(shelterLevelDef(c.shelter.level)?.name||'窝棚')} · ${esc(locationById(c.shelter.locationId)?.name||'未知')}</div>`:''}`);
  }
  function backMorning(){if(state.phase==='MAP'&&!state.travelDecisionMade){state.phase='MORNING';save();render();}}
  function renderHome(){
    const s=load();
    const cast=D.characters.map(c=>`<img src="${esc(c.portrait)}" alt="${esc(c.name)}">`).join('');
    app.innerHTML=`<div class="screen center homeScreen"><div class="homeHero"><img src="assets/home-island.jpg" alt="八十一天海岛"></div><div class="subbrand homeSub">DAY 81 · 荒岛生存卡牌冒险</div><div class="castStrip">${cast}</div><div class="tagline">飞机迫降荒岛。六个人活了下来。<br>探索、关系、营地与危机，会让每一局都产生不同的故事。<br><b>救援将在第八十一天到来——前提是，你还活着。</b></div><button class="btn" onclick="Game.selectScreen()">开始游戏</button>${s?'<button class="btn secondary" style="margin-top:10px" onclick="Game.continueGame()">继续游戏</button>':''}<button class="btn ghost" style="margin-top:10px" onclick="Game.showLeaderboard()">🏆 排行榜</button><div class="muted" style="margin-top:16px;font-size:12px">建议开启声音 · 手机首次点击后会自动解锁音效</div></div>`;
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
  function miniSceneHtml(loc){
    const peers=locationPeers();return `<section class="sceneStrip"><div class="sceneStripHead"><b>${esc(loc?.name||'未知地点')}</b><span>${peers.length?`同地点${peers.length}人`:'独自一人'}</span></div><div class="sceneStripImage"><img src="${esc(loc?.scene||'')}" alt="${esc(loc?.name||'地点')}"><div class="sceneStripPeople">${peers.map(c=>`<button onclick="Game.personInfo('${c.id}')">${portrait(c,'sceneAvatar')}<span>${esc(c.name)}</span></button>`).join('')}</div></div></section>`;
  }
  function showStatus(){
    const p=player(),loc=locationById(p.locationId),s=shelterOf(p);modal(`<div class="row between"><h2>角色状态</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div>${statusHtml(p)}<div class="infoGrid"><span>难度 <b>${esc(state.difficultyLabel)}</b></span><span>位置 <b>${esc(loc?.name||'未知')}</b></span><span>AI/技能 <b>主角操控</b></span><span>窝棚 <b>${s.level?esc(shelterLevelDef(s.level)?.name):'未搭建'}</b></span></div><button class="btn ghost" onclick="Game.closeModal();Game.restartAsk()">重新开始本局</button>`);
  }
  function showInventory(){
    const p=player();modal(`<div class="row between"><h2>🎒 背包 ${p.inventory.length}/${invLimit(p)}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="inventory inventory8 modalInventory">${invHtml(p,true)}</div><p class="muted">点击道具查看效果。专属初始道具永久持有。</p>`);
  }
  function showOverview(){
    const s=activeStoryTarget(),cr=state.crisisNotice;modal(`<div class="row between"><h2>本局资料</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="overviewList"><button class="choice" onclick="Game.closeModal();Game.showStatus()">👤 角色状态</button><button class="choice" onclick="Game.closeModal();Game.showInventory()">🎒 背包</button><button class="choice" onclick="Game.closeModal();Game.survivors()">👥 人物关系</button><button class="choice" onclick="Game.closeModal();Game.showCamp()">🏕️ 公共营地</button><button class="choice" onclick="Game.closeModal();Game.showShelter()">🏠 我的窝棚</button><button class="choice" onclick="Game.closeModal();Game.logs()">📖 生存日志</button></div>${cr?`<div class="crisisBanner now"><div class="crisisIcon">${cr.icon}</div><div><b>${esc(cr.name)}</b><span>${cr.left===0?'今晚发生':`${cr.left}天后发生`} · ${esc(cr.desc)}</span></div></div>`:''}${s?`<div class="storyHint"><span>📖</span><div><b>${esc(s.chain.name)}</b><small>${s.ready?'新线索：'+esc(locationById(s.step.location)?.name||'未知'):`等待${s.wait}天`}</small></div></div>`:''}`);
  }

  function renderMain(){
    const p=player();if(state.phase==='NIGHT_REPORT')return renderNight();if(state.phase==='VICTORY'||state.phase==='GAME_OVER')return renderEnd();let center='',typeAfter=null;const loc=locationById(p.locationId);
    if(state.phase==='MAP') center=mapHtml();
    else if(state.phase==='MORNING'){
      center=`${sceneVisualHtml(loc,state.locationBrief||makeLocationBrief(p.locationId,false))}<section class="paper morningChoice compactMorning"><div class="section-title">新的一天 · 先决定停留地点</div><div class="choices twoChoices"><button class="choice actionPrimary" onclick="Game.stayHere()">📍 留在当地<small>${esc(loc?.name||'这里')}</small></button><button class="choice" onclick="Game.openMap()">🗺️ 前往其他地点<small>打开地图选择</small></button></div></section>`;
    }
    else if(state.phase==='LOCATION') center=`${sceneVisualHtml(loc,state.locationBrief||loc?.desc||'')}${availableActionsHtml()}`;
    else if(state.phase==='INTERACTION'){
      const it=state.interaction,o=cBy(it?.targetId),scene=it?.scene,rel=relationScore(p,o),canTrade=rel>=25&&tradableItems(p).length&&tradableItems(o).length;
      center=`${miniSceneHtml(loc)}<section class="paper encounterPaper compactPaper"><div class="interactionHeader">${portrait(o,'encounterPortrait')}<div><div class="event-title"><span class="roleName">${esc(o.name)}</span></div><div class="relationText ${relationClass(p,o)}">${relationLabel(p,o)} · ${rel>0?'+':''}${rel}</div></div></div><div class="interactionSceneTitle">${esc(scene.title||'简单交谈')}</div><div class="event-text">${richText(scene.text)}</div><div class="choices compactChoices">${scene.choices.map((ch,i)=>`<button class="choice" onclick="Game.interactionChoice(${i})">${esc(ch.text)}<small>${ch.kind==='check'?esc(riskHint({stat:ch.stat,risk:ch.risk})):esc(ch.risk||'')}</small></button>`).join('')}${rel>=25?`<button class="choice tradeChoice" ${canTrade?'':'disabled'} onclick="Game.interactionTrade()">🤝 交换道具<small>${canTrade?'由对方决定交换给你的道具':'至少一方没有可交易道具'}</small></button>`:''}<button class="choice" onclick="Game.cancelInteraction()">暂不互动</button></div></section>`;
    }
    else if(state.phase==='EVENT'&&state.currentEvent){
      const e=state.currentEvent,key=`${state.day}-${e.id}`,shouldType=lastTypedKey!==key,controls=e.choices.map((ch,i)=>`<button class="choice" onclick="Game.resolve(${i})">${esc(ch.text)}<small>${esc(riskHint(ch))}</small></button>`).join('');
      center=`${miniSceneHtml(loc)}<section class="paper eventPaper compactPaper ${e.storyChain?'storyPaper':''}"><div class="section-title">${e.storyChain?'📖 '+esc(e.storyName):'今日探索'} · ${esc(loc?.name||'')}</div><div class="event-title">${esc(e.name)}</div><div class="event-text" id="eventText">${shouldType?'':richText(e.text)}</div><div class="choices compactChoices ${shouldType?'typingLocked':''}" id="eventChoices">${controls}</div></section>`;if(shouldType){lastTypedKey=key;typeAfter=()=>typeText(document.getElementById('eventText'),e.text);}
    }
    else if(state.phase==='POST'||state.phase==='POST_ACTION'){
      const isExplore=state.phase==='POST';center=`${miniSceneHtml(loc)}<section class="paper eventPaper resultPaper"><div class="section-title">${isExplore?'探索结果':'行动结果'} · ${esc(loc?.name||'')}</div>${isExplore?`<div class="event-title">${esc(state.currentEvent?.name||'今日探索')}</div>`:''}<div class="result richResult">${richText(state.currentResult)}</div></section>${availableActionsHtml()}`;
    } else {state.phase=state.travelDecisionMade?'LOCATION':'MORNING';return renderMain();}
    app.innerHTML=`<div class="screen gameScreen">${compactHudHtml()}<main class="gameStage">${center}</main>${quickDockHtml()}</div>`;if(state.pending)renderPending();if(typeAfter)setTimeout(typeAfter,70);setTimeout(maybeShowDeathAlert,80);
  }
  function renderNight(){const loc=state.lastNight?.locationId?locationById(state.lastNight.locationId):null;const affected=loc&&player().locationId===loc.id;app.innerHTML=`<div class="screen center"><section class="paper nightPaper"><div class="section-title">DAY ${state.day} · 夜晚${loc?` · ${esc(loc.name)}`:''}</div><div class="event-title">${esc(state.lastNight.title)}</div><div class="event-text">${richText(state.lastNight.text)}</div>${loc?`<div class="nightScope ${affected?'affected':''}">${affected?'⚠ 该事件发生在你所在地点':'该事件只影响 '+esc(loc.name)+' 的幸存者'}</div>`:''}</section><button class="btn" onclick="Game.nextDay()">进入 DAY ${state.day+1}</button></div>`;}
  function renderEnd(){const p=player(),win=state.phase==='VICTORY',[title,txt]=rating(state.score),survived=win?81:Math.max(1,state.day),lb=state.leaderboard||{submitted:false};app.innerHTML=`<div class="screen center"><div class="subbrand">${win?'DAY 81 · RESCUE':'SURVIVAL ENDED'}</div><div class="brand" style="font-size:34px">${win?'救援来了':'求生结束'}</div><div class="tagline">${win?'清晨，你被一种陌生的声音惊醒。不是风，也不是海浪。是船。':`DAY ${state.day}，${esc(p.name)}倒下了。<br>原因：${esc(p.deathCause||'生命归零')}`}</div><div class="score">${state.score}</div><div class="name">${title}</div><div class="tagline" style="margin:10px auto 18px">${txt}</div><section class="card" style="text-align:left"><div class="section-title">本局记录</div><div class="row between"><span>幸存天数</span><b>${survived}天</b></div><div class="row between"><span>难度</span><b>${esc(state.difficultyLabel)}</b></div><div class="row between"><span>最终得分</span><b>${state.score}</b></div></section><section class="card leaderboardSubmit"><div class="section-title">🏆 提交排行榜</div>${lb.submitted?`<div class="rankSuccess">账号 <b>${esc(lb.account)}</b> 当前排名：<strong>#${lb.rank||'-'}</strong></div>`:`<div class="meta" style="margin-bottom:10px">输入6—8个字符的账号。相同账号只保留最好成绩。</div><div class="submitRow"><input id="rankAccount" maxlength="8" placeholder="6-8字符账号"><button class="btn small" onclick="Game.submitScore()">提交</button></div><div id="rankMsg" class="rankMsg"></div>`}<button class="btn ghost" style="margin-top:10px" onclick="Game.showLeaderboard()">查看前100名</button></section><section class="card" style="text-align:left"><div class="section-title">最终幸存者</div>${state.characters.map(c=>`<div class="row between ${c.dead?'dead':''}" style="padding:7px 0"><span class="endPerson">${portrait(c,'endPortrait')} ${esc(c.name)}</span><span>${c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:'获救'}</span></div>`).join('')}</section><button class="btn" onclick="Game.selectScreen()">再来一次</button><button class="btn ghost" onclick="Game.home()">返回首页</button></div>`;}
  function renderPending(){
    const p=player();if(state.pending.type==='pick'){const opts=state.pending.choices.map(id=>`<button class="choice" onclick="Game.pickItem('${id}')">${item(id).ico} <b class="itemName">${esc(item(id).name)}</b><small>${esc(item(id).desc)}</small></button>`).join('');document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>选择一件物资</h2><p class="muted">你只能带走其中一件。</p><div class="choices">${opts}</div></div></div>`);return;}
    const id=state.pending.incoming,it=item(id),old=discardableItems(p).map(x=>`<button class="choice" onclick="Game.replace('${x}')">丢弃 ${item(x).ico} <b class="itemName">${esc(item(x).name)}</b></button>`).join('');
    document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>背包已满</h2><p>新获得：${it.ico} <b class="itemName">${esc(it.name)}</b></p><p class="muted">专属初始道具不可丢弃。请选择一件普通道具丢弃，或放弃新道具。</p><div class="choices">${old}<button class="choice" onclick="Game.replace('__new__')">放弃 ${esc(it.name)}</button></div></div></div>`);
  }

  function modal(html){document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="modal"><div class="modal">${html}</div></div>`);}
  function closeModal(){document.getElementById('modal')?.remove();}
  function itemInfo(id){closeModal();const it=item(id),starter=isStarterItem(player(),id),can=it.consumable&&['LOCATION','MAP','POST','POST_ACTION'].includes(state.phase);modal(`<div class="row between"><h2>${it.ico} <span class="itemName">${esc(it.name)}</span></h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><p>${esc(it.desc)}</p><div class="muted">${starter?'角色专属 · 永久持有 · 不可交易 / 夺取 / 丢弃':it.consumable?'消耗品':'携带生效 · 同名效果不叠加'}</div>${can?`<button class="btn" style="margin-top:14px" onclick="Game.use('${id}')">使用</button>`:''}`);}
  function survivors(){
    const ploc=player().locationId,p=player();
    modal(`<div class="row between"><h2>人物关系</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="list">${state.characters.map(c=>`<div class="listItem relationItem ${c.dead?'dead':''}">${portrait(c,'listPortrait')}<div class="relationBody"><div class="row between"><b>${esc(c.name)} · ${esc(c.job)}</b><span>${c.dead?'已死亡':hearts(c)}</span></div><div class="meta">${c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:`健康 ${healthDots(c)} · ${c.id===state.playerId||c.locationId===ploc?'📍'+esc(locationById(c.locationId)?.name||'未知'):'位置未知'}${c.id!==state.playerId?` · AI ${esc(c.aiLabel||'中等')}`:''}`}</div>${c.id!==p.id&&!c.dead?`<div class="relationMeter"><i style="width:${clamp((relationScore(p,c)+100)/2,0,100)}%"></i></div><div class="relationText ${relationClass(p,c)}">${relationLabel(p,c)} · ${relationScore(p,c)>0?'+':''}${relationScore(p,c)}</div>`:'<div class="relationText">主角</div>'}</div></div>`).join('')}</div>`);
  }
  function logs(){modal(`<div class="row between"><h2>生存日志</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="log">${state.history.length?state.history.slice().reverse().map(x=>`<div class="listItem"><b>DAY ${x.day}</b><br>${richText(x.msg)}</div>`).join(''):'还没有值得记录的事。'}</div>`);}


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


  function maybeShowDeathAlert(){
    if(!state?.deathAlerts?.length||document.querySelector('.modalWrap'))return;
    const a=state.deathAlerts[0],c=cBy(a.id);modal(`<div class="deathAlert"><div class="deathAlertIcon">⚠</div><h2>重要讯息</h2>${c?portrait(c,'deathPortrait'):''}<div class="deathName">${esc(a.name)} 已死亡</div><p>DAY ${a.day} · ${esc(a.cause||'生命归零')}</p><button class="btn danger" onclick="Game.closeDeathAlert()">知道了</button></div>`);sound('warning');
  }
  function closeDeathAlert(){document.getElementById('modal')?.remove();if(state?.deathAlerts?.length)state.deathAlerts.shift();save();setTimeout(maybeShowDeathAlert,80);}

  function render(){document.querySelectorAll('.modalWrap').forEach(x=>x.remove());if(!state){renderHome();return;}renderMain();if(state.pending&&!document.getElementById('pending'))renderPending();setTimeout(maybeShowDeathAlert,100);}

  window.Game={
    home(){state=null;renderHome();},selectScreen(){app.innerHTML='';renderSelect();},chooseDifficulty(id){renderDifficulty(id);},continueGame(){state=load();if(!state){renderHome();return;}render();},
    start(id,difficultyKey){if(load()&&!confirm('开始新游戏会覆盖旧存档，确定吗？'))return;state=newState(id,difficultyKey||'normal');log(`${player().name}成为主角。初始位置：${locationById(player().locationId).name}。`);startDay(true);},
    exploreHere:exploreCurrent,resolve:resolveInstantOrCheck,endDay,nextDay,itemInfo,survivors,logs,closeModal,use(id){closeModal();useItem(player(),id);},toggleSound,showCamp,buildCamp,claimCamp,showShelter,buildOwnShelter,upgradeOwnShelter,installShelterFacility,showStatus,showInventory,showOverview,closeDeathAlert,
    openMap,stayHere:chooseStay,move:moveToLocation,backLocation:backMorning,personInfo,interact:beginInteraction,interactionChoice,interactionTrade:interactionTradeModal,interactionTradeChoose,cancelInteraction,restHere:restAtLocation,
    replace(oldId){const p=player(),incoming=state.pending.incoming;if(oldId!=='__new__'){if(isStarterItem(p,oldId)){toast('专属初始道具不可丢弃');return;}const i=p.inventory.indexOf(oldId);if(i>=0)p.inventory.splice(i,1,incoming);toast(`丢弃${item(oldId).name}，留下${item(incoming).name}`);}else toast(`放弃${item(incoming).name}`);state.pending=null;save();render();},
    pickItem(id){state.pending=null;gainItem(player(),id,'选择获得');save();render();},restartAsk(){if(confirm('确定放弃当前进度并重新开始吗？')){localStorage.removeItem(SAVE);state=null;renderSelect();}},
    showLeaderboard,submitScore
  };

  document.addEventListener('pointerdown',unlockAudio,{passive:true});
  document.addEventListener('touchstart',unlockAudio,{passive:true});
  document.addEventListener('click',unlockAudio,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&soundEnabled)unlockAudio();});

  async function boot(){
    try{const r=await fetch('/api/game-config',{cache:'no-store'});if(r.ok){const cfg=await r.json();GAME_CONFIG={roleNames:{...DEFAULT_GAME_CONFIG.roleNames,...(cfg.roleNames||{})},difficulty:{...DEFAULT_GAME_CONFIG.difficulty,...(cfg.difficulty||{})}};}}catch(e){console.warn('game config unavailable, using defaults',e);}
    applyNamesToCharacters(D.characters);renderHome();
  }
  boot();
})();
