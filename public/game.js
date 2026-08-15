(() => {
  'use strict';
  const D=window.DAY81_DATA, NPC=window.DAY81_NPC;
  const SAVE='day81_save_v1', ACH='day81_achievements_v1';
  const $=s=>document.querySelector(s);
  const app=document.getElementById('app');
  let state=null;
  const DEFAULT_GAME_CONFIG={roleNames:{linlan:'林岚',zhouye:'周野',chenmo:'陈默',suqing:'苏晴',gaoyuan:'高远',xutang:'许棠'},difficulty:{nightEventChance:.50,baseCheckModifier:0,encounterInterval:5,avoidChance:.20,healthDecayChance:1,healthyLifeRecoverChance:.20,inventoryLimit:4,startingBonusFood:0}};
  let GAME_CONFIG=JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG));
  function rules(){return state?.rules||GAME_CONFIG.difficulty}
  function invLimit(c){return Number(c?.inventoryLimit||rules().inventoryLimit||4)}
  function applyNamesToCharacters(chars){for(const c of chars||[]){const n=GAME_CONFIG.roleNames?.[c.id];if(n)c.name=n}}

  function hashSeed(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rng(){ // Mulberry32 stateful RNG
    let a=state.rngState>>>0;a=(a+0x6D2B79F5)>>>0;state.rngState=a;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;
  }
  function chance(p){return rng()<p}
  function rand(arr){return arr[Math.floor(rng()*arr.length)]}
  function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function pairKey(a,b){return [a,b].sort().join('|')}
  function alive(){return state.characters.filter(c=>!c.dead)}
  function player(){return state.characters.find(c=>c.id===state.playerId)}
  function cBy(id){return state.characters.find(c=>c.id===id)}
  function has(c,id){return c.inventory.includes(id)}
  function item(id){return D.items[id]}
  function stageInfo(day=state.day){if(day<=20)return['初到荒岛',1];if(day<=40)return['生存',2];if(day<=60)return['消耗',3];return['最后的等待',4]}
  function save(){if(!state)return;try{localStorage.setItem(SAVE,JSON.stringify(state))}catch(e){console.warn('save failed',e)}}
  function load(){try{const x=JSON.parse(localStorage.getItem(SAVE)||'null');if(x&&x.version===1){x.rules={...DEFAULT_GAME_CONFIG.difficulty,...(x.rules||GAME_CONFIG.difficulty)};applyNamesToCharacters(x.characters);x.characters.forEach(c=>c.inventoryLimit=x.rules.inventoryLimit);return x}}catch(e){}return null}
  function log(msg){state.history.push({day:state.day,msg});if(state.history.length>150)state.history.splice(0,state.history.length-150)}
  function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1800)}

  function makeChar(base){return {...base,life:base.maxLife,health:3,inventory:[base.startItem],dead:false,deathDay:null,deathCause:'',healthyStreak:0,abilityCooldown:0,lowLifeSeen:false,skipDecay:false,damageShield:0,generalShield:0,nextCheckBonus:0,dayStartHealth:3,raincoatUsed:false,lifevestUsed:false,stats:{battles:0,wins:0,trades:0,avoids:0,itemsFound:1,itemsUsed:0}}}
  function newState(playerId){
    const seed=`${Date.now()}-${Math.random()}`;
    const currentRules={...DEFAULT_GAME_CONFIG.difficulty,...GAME_CONFIG.difficulty};
    const s={version:1,seed,rngState:hashSeed(seed),day:1,phase:'PREPARE',playerId,characters:D.characters.map(makeChar),rules:currentRules,relationships:{},freeTrades:{},recentEvents:[],currentEvent:null,eventResolved:false,currentResult:'',encounterDoneDay:0,encounter:null,nightDanger:0,rescueScore:0,history:[],statistics:{battles:0,battleWins:0,trades:0,itemsUsed:0,itemsFound:0,foodUsed:0,risksTaken:0},pending:null,lastNight:null,score:null};
    const bonusFoods=['apple','coconut'].slice(0,currentRules.startingBonusFood||0);
    s.characters.forEach(c=>{c.inventoryLimit=currentRules.inventoryLimit;for(const id of bonusFoods){if(c.inventory.length<currentRules.inventoryLimit)c.inventory.push(id)}});
    return s;
  }

  function addHealth(c,n){const before=c.health;c.health=clamp(c.health+n,0,3);return c.health-before}
  function addLife(c,n){const before=c.life;c.life=clamp(c.life+n,0,c.maxLife);return c.life-before}
  function applyDamage(c,n,cause='受伤'){
    if(n<=0)return 0;
    if(c.generalShield>0){c.generalShield--;return 0}
    if(c.damageShield>0){c.damageShield--;return 0}
    if(c.id==='zhouye'&&chance(.25))return 0;
    c.life-=n;
    if(c.life<=1)c.lowLifeSeen=true;
    if(c.life<=0)kill(c,cause);
    return n;
  }
  function healthDamage(c,n){if(n<=0)return 0;if(c.generalShield>0){c.generalShield--;return 0}const b=c.health;c.health=clamp(c.health-n,0,3);return b-c.health}
  function kill(c,cause){c.life=0;c.dead=true;c.deathDay=state.day;c.deathCause=cause;c.inventory=[];log(`${c.name}在DAY ${state.day}死亡：${cause}`)}
  function breakItem(c,id,reason='损坏'){
    if(!has(c,id))return false;
    if(c.id==='chenmo'&&chance(.35)){log(`${c.name}修好了${item(id).name}`);return false}
    c.inventory.splice(c.inventory.indexOf(id),1);log(`${c.name}的${item(id).name}${reason}`);return true;
  }
  function gainItem(c,id,source='获得'){
    if(!D.items[id])return;
    if(c.inventory.includes(id)&&!item(id).consumable){if(c.id===state.playerId)toast(`已有${item(id).name}，效果不能叠加`);return;}
    if(c.inventory.length<invLimit(c)){c.inventory.push(id);c.stats.itemsFound++;if(c.id===state.playerId){state.statistics.itemsFound++;toast(`${source}：${item(id).name}`)}return;}
    if(c.id===state.playerId){state.pending={type:'replace',incoming:id};save();render();return;}
    const discard=NPC.chooseDiscard(c,D,state.day,id);
    if(discard===id)return;
    c.inventory.splice(c.inventory.indexOf(discard),1,id);
  }
  function randomItem(filter){if(filter)return rand(filter);const foodChance=state.day<=20?.56:state.day<=40?.52:state.day<=60?.48:.44;const x=rng();if(x<foodChance)return rand(D.foodPool);if(x<foodChance+.11)return rand(D.medicalPool);return rand(D.itemPool.filter(id=>D.items[id].kind==='gear'||D.items[id].kind==='special'))}
  function highItem(){return rand(D.itemPool.filter(id=>(item(id).value||0)>=8))}

  function useItem(c,id){
    const idx=c.inventory.indexOf(id);if(idx<0)return;
    const it=item(id);if(!it.consumable)return;
    if(id==='flare'&&state.day<61){toast('DAY 61以后再使用信号弹更有意义');return;}
    let consumed=true, msg='';
    if(it.effect?.wildFood){if(chance(.75)){addHealth(c,1);msg='野果没问题，健康+1'}else{healthDamage(c,1);msg='野果让你不舒服，健康-1'}}
    else{
      if(it.effect?.health){let n=it.effect.health;if(it.effect.extraHealthChance&&chance(it.effect.extraHealthChance))n++;addHealth(c,n);msg=`健康+${n}`}
      if(it.effect?.life){const n=addLife(c,it.effect.life);msg=`生命+${n}`}
      if(it.effect?.skipDecay){c.skipDecay=true;msg+=(msg?'，':'')+'今晚不自然下降健康'}
      if(it.effect?.shield){c.damageShield+=it.effect.shield;msg='下一次生命伤害将被抵消'}
      if(it.effect?.generalShield){c.generalShield+=it.effect.generalShield;msg='下一次健康或生命损失将被抵消'}
      if(it.effect?.rescueScore){state.rescueScore+=it.effect.rescueScore;msg='你在高地打出信号，求救努力+2'}
    }
    if(c.id==='gaoyuan'&&it.kind==='food'&&chance(.25))consumed=false;
    if(consumed)c.inventory.splice(idx,1);
    c.stats.itemsUsed++;if(c.id===state.playerId){state.statistics.itemsUsed++;if(it.kind==='food')state.statistics.foodUsed++;toast(`${it.name}：${msg}${consumed?'':'（没有消耗）'}`)}
    save();render();
  }

  function checkChance(c,stat,difficulty='normal',tags=[]){
    const base={2:.30,3:.45,4:.60,5:.75}[c[stat]]||.45;
    let p=base+(difficulty==='easy'?.15:difficulty==='hard'?-.20:0)+(c.nextCheckBonus||0)+(rules().baseCheckModifier||0);
    if(stat==='luck'&&has(c,'coin'))p+=.10;
    if(tags.includes('climb')&&has(c,'rope'))p+=.25;
    if(tags.includes('mechanic')&&has(c,'multitool'))p+=.20;
    if(tags.includes('fish')&&has(c,'fishing'))p+=.30;
    if(tags.includes('fire')&&has(c,'lighter'))p+=.30;
    if(tags.includes('resource')&&has(c,'axe'))p+=.20;
    if(tags.includes('water')&&has(c,'bottle'))p+=.25;
    if(tags.includes('explore')&&has(c,'oldmap'))p+=.12;
    c.nextCheckBonus=0;
    p=clamp(p,.10,.95);
    let ok=chance(p);
    if(!ok&&c.id==='xutang'&&state.day>=1){
      const last=c.lastRetryDay||-99;if(state.day-last>=7){c.lastRetryDay=state.day;ok=chance(p);if(c.id===state.playerId)toast('冷静判断：自动重试一次');}
    }
    return ok;
  }

  function applyEffect(c,effect={},context='事件'){
    let msgs=[];
    if(effect.none)msgs.push('无事发生');
    if(effect.health){const n=effect.health>0?addHealth(c,effect.health):-healthDamage(c,-effect.health);msgs.push(`健康${n>=0?'+':''}${n}`)}
    if(effect.life){if(effect.life>0){const n=addLife(c,effect.life);msgs.push(`生命+${n}`)}else{applyDamage(c,-effect.life,context);msgs.push(`生命${effect.life}`)}}
    if(effect.skipDecay){c.skipDecay=true;msgs.push('今晚不自然下降健康')}
    if(effect.item){gainItem(c,effect.item);msgs.push(`获得${item(effect.item).name}`)}
    if(effect.randomItem){const id=randomItem();gainItem(c,id);msgs.push(`获得${item(id).name}`)}
    if(effect.randomHighItem){const id=highItem();gainItem(c,id);msgs.push(`获得${item(id).name}`)}
    if(effect.randomFood){const id=randomItem(D.foodPool);gainItem(c,id);msgs.push(`获得${item(id).name}`)}
    if(effect.randomFrom){const id=rand(effect.randomFrom);gainItem(c,id);msgs.push(`获得${item(id).name}`)}
    if(effect.randomItemChance){if(chance(effect.randomItemChance)){const id=randomItem();gainItem(c,id);msgs.push(`获得${item(id).name}`)}else msgs.push('里面什么也没有')}
    if(effect.pickItems){const choices=[];while(choices.length<effect.pickItems){const id=randomItem();if(!choices.includes(id))choices.push(id)}if(c.id===state.playerId){state.pending={type:'pick',choices};msgs.push(`发现${effect.pickItems}件物资，可选择1件`)}else{const id=[...choices].sort((a,b)=>NPC.itemValue(item(b),c,state.day)-NPC.itemValue(item(a),c,state.day))[0];gainItem(c,id);msgs.push(`获得${item(id).name}`)}}
    if(effect.loseItem){loseRandomItem(c);msgs.push('随机失去1件道具')}
    if(effect.loseFood){const foods=c.inventory.filter(id=>item(id).kind==='food');if(foods.length){const id=rand(foods);c.inventory.splice(c.inventory.indexOf(id),1);msgs.push(`${item(id).name}腐坏了`)}else msgs.push('你没有食物可坏')}
    if(effect.achievement){unlock(effect.achievement)}
    if(effect.rescueScore){state.rescueScore+=effect.rescueScore;msgs.push('求救努力有所增加')}
    if(effect.nightDanger){state.nightDanger+=effect.nightDanger;msgs.push('今晚危险似乎增加了')}
    if(effect.fromNpc){const donor=alive().filter(x=>x.id!==c.id&&x.inventory.length);if(donor.length){const d=rand(donor), iid=d.inventory.sort((a,b)=>NPC.itemValue(D.items[a],d,state.day)-NPC.itemValue(D.items[b],d,state.day))[0];d.inventory.splice(d.inventory.indexOf(iid),1);gainItem(c,iid);msgs.push(`${d.name}留下了${item(iid).name}`)}else msgs.push('最后什么也没找到')}
    return msgs.join('；');
  }
  function loseRandomItem(c){if(!c.inventory.length)return null;if(has(c,'drybag'))return null;const id=rand(c.inventory);c.inventory.splice(c.inventory.indexOf(id),1);return id}
  function beastHazard(c){if(has(c,'torch')){if(chance(.3))breakItem(c,'torch');return '火把吓退了野兽'}const ok=checkChance(c,'agi','normal',[]);if(ok)return '成功躲开';applyDamage(c,1,'野兽袭击');return '遭到袭击，生命-1'}
  function rainHazard(c){if(has(c,'tarp'))return '雨布挡住了暴雨';if(has(c,'raincoat')&&!c.raincoatUsed){c.raincoatUsed=true;breakItem(c,'raincoat');return '破旧雨衣挡住了这一次暴雨';}healthDamage(c,1);return '健康-1'}

  function chooseEvent(){
    const eligible=D.events.filter(e=>(!e.minDay||state.day>=e.minDay)&&!state.recentEvents.includes(e.id));
    let pool=eligible;
    if(state.day>=61&&(has(player(),'mirror')||has(player(),'whistle'))){const rescue=eligible.filter(e=>e.rescue);if(rescue.length&&chance(.18))pool=rescue}
    if(!pool.length){state.recentEvents=[];pool=D.events.filter(e=>!e.minDay||state.day>=e.minDay)}
    const e=rand(pool);state.recentEvents.push(e.id);if(state.recentEvents.length>8)state.recentEvents.shift();return e;
  }
  function drawEvent(){
    if(state.eventResolved||state.currentEvent)return;
    state.currentEvent=chooseEvent();state.phase='EVENT';save();render();
  }
  function resolveInstantOrCheck(index=null){
    const c=player(),e=state.currentEvent;if(!e||state.eventResolved)return;
    let result='';
    if(e.type==='instant')result=applyEffect(c,e.effect,e.name);
    else if(e.type==='hazard'){result=e.hazard==='beast'?beastHazard(c):rainHazard(c)}
    else if(e.type==='check'){
      const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]);result=ok?`检定成功。${applyEffect(c,e.success,e.name)}`:`检定失败。${applyEffect(c,e.fail,e.name)}`;
    } else if(e.type==='choice') result=resolveChoice(c,e,e.choices[index],false);
    state.eventResolved=true;state.phase='POST';state.currentResult=result||'无事发生';if(c.dead){endGame(false);return}save();render();
  }
  function resolveChoice(c,e,ch,isNpc){
    if(!ch)return '无事发生';if(ch.risk==='危险'&&c.id===state.playerId)state.statistics.risksTaken++;
    if(ch.action==='none')return '你选择不冒险。';
    if(ch.action==='check'){const ok=checkChance(c,ch.stat,ch.difficulty,ch.tags||e.tags||[]);if(ok)return `检定成功。${applyEffect(c,ch.success,e.name)}`;const f=ch.fail||{};if(f.chance&&!chance(f.chance))return '检定失败，但没有造成进一步损失。';if(f.beast)return `检定失败。${beastHazard(c)}`;return `检定失败。${applyEffect(c,f,e.name)}`}
    if(ch.action==='randomFood'){const r=rng();if(r<.6){addHealth(c,1);return '味道古怪，但健康+1'}if(r<.85)return '你等了一会儿，似乎没事。';healthDamage(c,1);return '胃开始翻腾，健康-1'}
    if(ch.action==='gambleFood'){const r=rng();if(r<.55){addHealth(c,1);return '勉强能吃，健康+1'}if(r<.8)return '没有明显效果。';applyDamage(c,1,'食物中毒');return '情况比想象糟，生命-1'}
    if(ch.action==='mushroom'){const r=rng();if(r<.5){addHealth(c,2);return '居然能吃，健康+2'}if(r<.8)return '没有明显效果。';applyDamage(c,1,'误食有毒蘑菇');return '你很快意识到判断错了，生命-1'}
    return '无事发生';
  }

  function startDay(){
    const p=player();
    if(p.id==='linlan'&&p.life===1&&p.lowLifeSeen&&p.abilityCooldown<=0&&chance(.3)){addLife(p,1);p.abilityCooldown=5;log('林岚的急救本能触发，生命+1');}
    state.characters.forEach(c=>{if(c.abilityCooldown>0)c.abilityCooldown--;if(!c.dead)c.dayStartHealth=c.health});
    state.phase='PREPARE';state.currentEvent=null;state.eventResolved=false;state.currentResult='';state.nightDanger=0;save();render();
  }

  function dueEncounter(){const n=Math.max(3,Number(rules().encounterInterval)||5);return state.day>1&&(state.day-1)%n===0&&state.encounterDoneDay!==state.day&&alive().length>=2}
  function beginEncounter(){
    const a=alive();shuffle(a);const pair=a.slice(0,2);state.encounter={a:pair[0].id,b:pair[1].id,result:'',resolved:false};
    if(!pair.some(c=>c.id===state.playerId)){resolveNpcEncounter(pair[0],pair[1]);state.encounterDoneDay=state.day;state.encounter=null;save();render();return;}
    state.phase='ENCOUNTER';save();render();
  }
  function enemy(a,b){return state.relationships[pairKey(a.id,b.id)]==='enemy'}
  function makeEnemy(a,b){state.relationships[pairKey(a.id,b.id)]='enemy'}
  function combatPower(c){let weaponBonus=0;if(has(c,'dagger')||has(c,'spear'))weaponBonus=1;return c.str+c.agi+weaponBonus}
  function fight(a,b){
    makeEnemy(a,b);a.stats.battles++;b.stats.battles++;if(a.id===state.playerId||b.id===state.playerId)state.statistics.battles++;
    const diff=combatPower(a)-combatPower(b);const p=diff>=3?1:diff===2?.9:diff===1?.7:diff===0?.5:diff===-1?.3:diff===-2?.1:0;
    const winA=chance(p),w=winA?a:b,l=winA?b:a;w.stats.wins++;if(w.id===state.playerId)state.statistics.battleWins++;
    let loot='';if(l.inventory.length){const id=rand(l.inventory);l.inventory.splice(l.inventory.indexOf(id),1);gainItem(w,id,'战利品');loot=`，夺得${item(id).name}`}
    applyDamage(l,1,'与幸存者战斗');
    return `${w.name}获胜${loot}；${l.name}生命-1。`;
  }
  function trade(a,b,playerGiveId=null){
    a.stats.trades++;b.stats.trades++;if(a.id===state.playerId||b.id===state.playerId)state.statistics.trades++;
    if(!a.inventory.length&&!b.inventory.length)return '双方都没有道具，交易作罢。';
    const freeKey=pairKey(a.id,b.id), lastFree=state.freeTrades?.[freeKey]||-99;
    if(!a.inventory.length){if(state.day-lastFree<10)return '这两个人最近已经发生过一次免费赠予，本次交易取消。';const give=[...b.inventory].sort((x,y)=>NPC.itemValue(item(x),b,state.day)-NPC.itemValue(item(y),b,state.day))[0];b.inventory.splice(b.inventory.indexOf(give),1);gainItem(a,give,'免费获得');state.freeTrades[freeKey]=state.day;return `${a.name}没有道具，${b.name}给了TA一件${item(give).name}。`}
    if(!b.inventory.length){if(state.day-lastFree<10)return '这两个人最近已经发生过一次免费赠予，本次交易取消。';const give=playerGiveId&&a.id===state.playerId?playerGiveId:[...a.inventory].sort((x,y)=>NPC.itemValue(item(x),a,state.day)-NPC.itemValue(item(y),a,state.day))[0];a.inventory.splice(a.inventory.indexOf(give),1);gainItem(b,give);state.freeTrades[freeKey]=state.day;return `${b.name}没有道具，免费获得了${item(give).name}。`}
    const aiA=a.id===state.playerId?playerGiveId:[...a.inventory].sort((x,y)=>NPC.itemValue(item(x),a,state.day)-NPC.itemValue(item(y),a,state.day))[0];
    const aiB=b.id===state.playerId?playerGiveId:[...b.inventory].sort((x,y)=>NPC.itemValue(item(x),b,state.day)-NPC.itemValue(item(y),b,state.day))[0];
    if(!aiA||!aiB)return '交易取消。';
    a.inventory.splice(a.inventory.indexOf(aiA),1);b.inventory.splice(b.inventory.indexOf(aiB),1);a.inventory.push(aiB);b.inventory.push(aiA);
    return `${a.name}用${item(aiA).name}换得${item(aiB).name}。`;
  }
  function encounterAction(action,giveId=null){
    const e=state.encounter,p=player(),o=cBy(e.a===p.id?e.b:e.a);let result='';
    if(action==='fight')result=fight(p,o);
    else if(action==='avoid'){
      p.stats.avoids++;const baseAvoid=Number(rules().avoidChance)||.20;const success=chance(clamp(baseAvoid+(p.id==='suqing'?.15:0),.05,.95));if(success)result='你成功避开了对方。';else if(enemy(p,o)||chance(.5))result=`躲避失败。${fight(p,o)}`;else result=`躲避失败。${trade(p,o,p.inventory[0]||null)}`;
    } else if(action==='trade')result=trade(p,o,giveId);
    e.result=result;e.resolved=true;state.encounterDoneDay=state.day;log(`人物遭遇：${result}`);if(p.dead){endGame(false);return}save();render();
  }
  function closeEncounter(){state.encounter=null;state.phase='PREPARE';save();render()}
  function resolveNpcEncounter(a,b){const act=NPC.encounterAction(a,b,D,rng,enemy(a,b));let r;if(act==='fight')r=fight(a,b);else if(act==='trade')r=trade(a,b);else{const baseAvoid=Number(rules().avoidChance)||.20;const avoid=chance(clamp(baseAvoid+(a.id==='suqing'?.15:0),.05,.95));r=avoid?'双方彼此避开，没有发生冲突。':(enemy(a,b)||chance(.5)?`躲避失败。${fight(a,b)}`:`躲避失败。${trade(a,b)}`)}log(`${a.name}与${b.name}相遇：${r}`)}

  function npcUseNeeds(c){
    if(c.dead)return;
    const firstAid=c.inventory.indexOf('first_aid');if(c.life<=Math.max(1,c.maxLife-2)&&firstAid>=0){useNpcItem(c,'first_aid')}
    if(NPC.shouldUseFood(c)){const food=c.inventory.find(id=>item(id).kind==='food');if(food)useNpcItem(c,food)}
  }
  function useNpcItem(c,id){const it=item(id),idx=c.inventory.indexOf(id);if(idx<0||!it.consumable)return;if(it.effect?.health)addHealth(c,it.effect.health);if(it.effect?.life)addLife(c,it.effect.life);if(it.effect?.skipDecay)c.skipDecay=true;if(it.effect?.shield)c.damageShield++;if(it.effect?.generalShield)c.generalShield++;if(it.effect?.wildFood){if(chance(.75))addHealth(c,1);else healthDamage(c,1)};let consume=true;if(c.id==='gaoyuan'&&it.kind==='food'&&chance(.25))consume=false;if(consume)c.inventory.splice(idx,1);}
  function npcTurn(c){
    if(c.dead)return;npcUseNeeds(c);const e=chooseNpcEvent();
    if(e.type==='instant')applyEffect(c,e.effect,e.name);
    else if(e.type==='hazard'){if(e.hazard==='beast')beastHazard(c);else rainHazard(c)}
    else if(e.type==='check'){const ok=checkChance(c,e.stat,e.difficulty,e.tags||[]);applyEffect(c,ok?e.success:e.fail,e.name)}
    else if(e.type==='choice'){const ix=NPC.eventChoice(c,e,D,rng);resolveChoice(c,e,e.choices[ix],true)}
    npcUseNeeds(c);
  }
  function chooseNpcEvent(){const eligible=D.events.filter(e=>!e.minDay||state.day>=e.minDay);return rand(eligible)}

  function endDay(){
    const p=player();if(p.dead)return;
    state.characters.filter(c=>!c.dead&&c.id!==state.playerId).forEach(npcTurn);
    const report=runNight();settleDay();
    if(p.dead){endGame(false);return}
    if(state.day>=80){state.day=81;endGame(true);return}
    state.lastNight=report;state.phase='NIGHT_REPORT';save();render();
  }
  function runNight(){
    let trigger=(Number(rules().nightEventChance)||.50)+state.nightDanger;if(has(player(),'flashlight'))trigger-=.15;trigger=clamp(trigger,.15,.85);
    if(!chance(trigger))return {title:'今夜平静',text:'风从树林里穿过去。没有发生特别的事。'};
    const eligible=D.nights.filter(n=>!n.minDay||state.day>=n.minDay);const n=rand(eligible);const ef=n.effect, living=alive();let extra=[];
    if(ef.allHazard==='rain')living.forEach(c=>extra.push(`${c.name}：${rainHazard(c)}`));
    if(ef.randomHazard==='beast'&&living.length){const c=rand(living);extra.push(`${c.name}：${beastHazard(c)}`)}
    if(ef.weakHealth){living.filter(c=>c.health<=1).forEach(c=>{healthDamage(c,1);extra.push(`${c.name}健康-1`)})}
    if(ef.randomLoseItem&&living.length){const c=rand(living),id=loseRandomItem(c);if(id)extra.push(`${c.name}失去${item(id).name}`)}
    if(ef.randomHealthDamage)living.forEach(c=>{if(chance(ef.randomHealthDamage)){healthDamage(c,1);extra.push(`${c.name}健康-1`)}})
    if(ef.randomHealth&&living.length){const c=rand(living);if(ef.randomHealth>0)addHealth(c,ef.randomHealth);else healthDamage(c,-ef.randomHealth);extra.push(`${c.name}健康${ef.randomHealth>0?'+':''}${ef.randomHealth}`)}
    if(ef.lowestHealth&&living.length){const min=Math.min(...living.map(c=>c.health));const c=rand(living.filter(x=>x.health===min));addHealth(c,ef.lowestHealth);extra.push(`${c.name}健康+1`)}
    if(ef.allChanceHealth)living.forEach(c=>{if(chance(ef.allChanceHealth)){healthDamage(c,1);extra.push(`${c.name}健康-1`)}})
    if(ef.randomItem&&living.length){const c=rand(living),id=randomItem();gainItem(c,id);extra.push(`${c.name}获得${item(id).name}`)}
    if(ef.nextCheckBonus)living.forEach(c=>c.nextCheckBonus=Math.max(c.nextCheckBonus,ef.nextCheckBonus));
    if(ef.protectWeak)living.filter(c=>c.health<=1).forEach(c=>c.skipDecay=true);
    if(ef.rescueScore)state.rescueScore+=ef.rescueScore;
    if(ef.relationDown&&living.length>=2){const [a,b]=shuffle([...living]).slice(0,2);extra.push(`${a.name}和${b.name}之间的气氛变差了`)}
    if(ef.theft&&living.length>=2&&chance(.28)){const [a,b]=shuffle([...living]).slice(0,2);if(b.inventory.length&&a.inventory.length<invLimit(a)){const id=rand(b.inventory);b.inventory.splice(b.inventory.indexOf(id),1);a.inventory.push(id);extra.push(`${a.name}拿走了${b.name}的${item(id).name}`)}}
    return {title:n.name,text:n.text+(extra.length?'\n'+extra.join('；'):'')};
  }
  function settleDay(){
    for(const c of alive()){
      const beganZero=(c.dayStartHealth===0);
      if(beganZero && c.health===0){applyDamage(c,1,'长期缺乏食物');}
      else if(c.health>0 && !c.skipDecay && chance(Number(rules().healthDecayChance)??1))c.health=clamp(c.health-1,0,3);
      c.skipDecay=false;
      if(c.dead)continue;
      if(c.health>=2)c.healthyStreak++;else c.healthyStreak=0;
      if(c.healthyStreak>=3){if(chance(Number(rules().healthyLifeRecoverChance)??.20))addLife(c,1);c.healthyStreak=0}
    }
    state.currentEvent=null;state.eventResolved=false;state.currentResult='';
  }
  function nextDay(){state.day++;state.lastNight=null;startDay()}

  function unlock(id){let list=[];try{list=JSON.parse(localStorage.getItem(ACH)||'[]')}catch(e){}if(!list.includes(id)){list.push(id);localStorage.setItem(ACH,JSON.stringify(list))}}
  function endGame(win){
    const p=player();state.phase=win?'VICTORY':'GAME_OVER';if(win){unlock('day81');if(alive().length===6)unlock('all_alive');if(state.statistics.battles===0)unlock('pacifist');if(state.statistics.battles>=5)unlock('island_boss')}
    const survived=win?81:Math.max(1,state.day);let score=Math.round((survived/81)*50)+(win?20:0);
    score+=Math.round(10*((p.life/p.maxLife)*.7+(p.health/3)*.3));score+=Math.min(8,Math.round((p.inventory.reduce((s,id)=>s+(item(id).value||0),0)/32)*8));score+=Math.max(0,Math.min(7,Math.round(state.statistics.trades*1.5-state.statistics.battles*.6+3)));score+=Math.min(5,Math.round(state.rescueScore));score=clamp(Math.round(score),0,100);
    state.score=score;save();render();
  }
  function rating(score){if(score>=95)return['荒岛传奇','贝爷看了你的生存记录，决定先回去补补课。'];if(score>=85)return['生存大师','你不是在荒岛求生，你像是在这里短期驻场。'];if(score>=70)return['靠谱幸存者','虽然狼狈，但救援船最终看到的是一个还能自己走上船的人。'];if(score>=55)return['命够硬','有些时候你靠策略，有些时候你纯粹靠命。'];if(score>=40)return['岛上老油条','能活这么久，已经不能完全用运气解释。'];if(score>=20)return['生存体验卡','你大概已经知道，下次什么东西不能乱吃了。'];return['三日游游客','无人岛甚至还没来得及记住你的名字。']}

  function riskHint(ch){const p=player();if(p.id==='suqing')return ch.risk?`风险：${ch.risk}`:'';if(has(p,'binoculars')&&ch.risk==='危险')return '这里似乎有危险……';return ch.stat?`${{str:'力量',agi:'敏捷',int:'知识',luck:'幸运'}[ch.stat]||''}检定`:''}
  function hearts(c){return '❤️'.repeat(Math.max(0,c.life))+'♡'.repeat(Math.max(0,c.maxLife-c.life))}
  function healthDots(c){return '●'.repeat(c.health)+'○'.repeat(3-c.health)}
  function invHtml(c,interactive=true){let h='';for(let i=0;i<invLimit(c);i++){const id=c.inventory[i];if(!id){h+=`<div class="slot empty"><div class="ico">＋</div><div class="label">空位</div></div>`;continue}const it=item(id);h+=`<button class="slot" ${interactive?`onclick="Game.itemInfo('${id}')"`:''}><div class="ico">${it.ico}</div><div class="label">${esc(it.name)}</div></button>`}return h}
  function statusHtml(c){return `<section class="card"><div class="person"><div><div class="name">${c.avatar} ${c.name} · ${c.job}</div><div class="meta">${c.sex} · ${c.age}岁</div></div><button class="btn small secondary" onclick="Game.survivors()">幸存者</button></div><div class="divider"></div><div>生命 <span class="hearts">${hearts(c)}</span></div><div>健康 <span class="healthdots">${healthDots(c)}</span></div><div class="stats"><div class="stat">力量<b>${c.str}</b></div><div class="stat">敏捷<b>${c.agi}</b></div><div class="stat">知识<b>${c.int}</b></div><div class="stat">幸运<b>${c.luck}</b></div></div></section>`}
  function topHtml(){const [st]=stageInfo();return `<div class="topbar"><div class="dayrow"><div class="day">DAY ${state.day} <span class="muted" style="font-size:13px">/ 81</span></div><div class="stage">${st}</div></div><div class="progress"><i style="width:${Math.min(100,state.day/81*100)}%"></i></div></div>`}

  function renderHome(){const s=load();app.innerHTML=`<div class="screen center"><div><div class="brand">八十一天</div><div class="subbrand">DAY 81</div><div class="tagline">飞机迫降荒岛。<br>六个人活了下来。<br>救援将在第八十一天到来。<br><b>前提是，你还活着。</b></div><button class="btn" onclick="Game.selectScreen()">开始游戏</button>${s?'<button class="btn secondary" style="margin-top:10px" onclick="Game.continueGame()">继续游戏</button>':''}<div class="muted" style="margin-top:20px;font-size:12px">单人卡牌生存冒险 · 一局约15～30分钟</div></div></div>`}
  function renderSelect(){app.innerHTML=`<div class="screen"><div class="brand" style="font-size:28px;text-align:center">选择幸存者</div><div class="grid2">${D.characters.map(c=>`<div class="card character"><div class="avatar">${c.avatar}</div><div class="name">${c.name}</div><div class="meta">${c.sex} · ${c.age}岁 · ${c.job}</div><div class="hearts" style="margin:8px 0">${'❤️'.repeat(c.maxLife)}</div><div class="meta">力量${c.str} · 敏捷${c.agi} · 知识${c.int} · 幸运${c.luck}</div><div class="ability">${c.ability}</div><div class="ability">初始：${item(c.startItem).ico}${item(c.startItem).name}</div><button class="btn small" style="margin-top:10px;width:100%" onclick="Game.start('${c.id}')">选择TA</button></div>`).join('')}</div><button class="btn ghost" onclick="Game.home()">返回</button></div>`}
  function renderMain(){const p=player();let center='';
    if(state.phase==='ENCOUNTER')return renderEncounter();
    if(state.phase==='NIGHT_REPORT')return renderNight();
    if(state.phase==='VICTORY'||state.phase==='GAME_OVER')return renderEnd();
    if(state.phase==='EVENT'&&state.currentEvent){const e=state.currentEvent;let controls='';if(e.type==='choice')controls=e.choices.map((ch,i)=>`<button class="choice" onclick="Game.resolve(${i})">${esc(ch.text)}<small>${esc(riskHint(ch))}</small></button>`).join('');else controls=`<button class="btn" onclick="Game.resolve()">执行</button>`;center=`<section class="paper"><div class="section-title">今日机遇</div><div class="event-title">${esc(e.name)}</div><div class="event-text">${esc(e.text)}</div><div class="choices">${controls}</div></section>`}
    else if(state.phase==='POST')center=`<section class="paper"><div class="section-title">今日结果</div><div class="event-title">${esc(state.currentEvent?.name||'今日机遇')}</div><div class="event-text">${esc(state.currentEvent?.text||'')}</div><div class="result">${esc(state.currentResult)}</div></section><button class="btn" onclick="Game.endDay()">结束今天</button>`;
    else center=`<section class="paper"><div class="section-title">今日行动</div><div class="event-title">${dueEncounter()?'你今天可能遇到其他幸存者':'准备好了吗？'}</div><div class="event-text">${dueEncounter()?`每隔${rules().encounterInterval}天，岛上的人会不可避免地碰面。`:'你可以先整理背包、使用消耗品，再抽取今天的机遇卡。'}</div></section>${dueEncounter()?'<button class="btn danger" onclick="Game.beginEncounter()">处理人物遭遇</button>':'<button class="btn" onclick="Game.draw()">抽取今日机遇</button>'}`;
    app.innerHTML=`<div class="screen">${topHtml()}${statusHtml(p)}${center}<section><div class="section-title">背包 · ${p.inventory.length}/${invLimit(p)}</div><div class="inventory">${invHtml(p,true)}</div></section><div class="row"><button class="btn small ghost" onclick="Game.logs()">生存日志</button><button class="btn small ghost" onclick="Game.restartAsk()">重新开始</button></div></div>`;
    if(state.pending)renderPending();
  }
  function renderEncounter(){const p=player(),o=cBy(state.encounter.a===p.id?state.encounter.b:state.encounter.a),en=enemy(p,o);const e=state.encounter;if(e.resolved){app.innerHTML=`<div class="screen">${topHtml()}${statusHtml(p)}<section class="paper"><div class="section-title">人物遭遇</div><div class="event-title">${o.avatar} ${o.name}</div><div class="event-text">${esc(e.result)}</div></section><button class="btn" onclick="Game.closeEncounter()">继续今天</button></div>`;return}
    const diff=combatPower(p)-combatPower(o),adv=diff>0?'优势':diff<0?'劣势':'势均力敌';let tradeBtn=en?'':`<button class="btn secondary" onclick="Game.tradeModal()">交易</button>`;
    app.innerHTML=`<div class="screen">${topHtml()}${statusHtml(p)}<section class="paper"><div class="section-title">强制遭遇</div><div class="event-title">${o.avatar} ${o.name} · ${o.job}</div><div class="event-text">生命 ${hearts(o)}\n健康 ${healthDots(o)}\n力量 ${o.str} · 敏捷 ${o.agi}\n背包 ${o.inventory.length}件\n关系：${en?'敌人':'非敌对'}\n战斗判断：${adv}</div></section><div class="choices"><button class="btn danger" onclick="Game.encounter('fight')">战斗</button><button class="btn secondary" onclick="Game.encounter('avoid')">躲避</button>${tradeBtn}</div></div>`}
  function renderNight(){app.innerHTML=`<div class="screen center"><section class="paper"><div class="section-title">DAY ${state.day} · 夜晚</div><div class="event-title">${esc(state.lastNight.title)}</div><div class="event-text">${esc(state.lastNight.text)}</div></section><button class="btn" onclick="Game.nextDay()">进入 DAY ${state.day+1}</button></div>`}
  function renderEnd(){const p=player(),win=state.phase==='VICTORY',[title,txt]=rating(state.score);const dead=state.characters.filter(c=>c.dead);app.innerHTML=`<div class="screen center"><div class="subbrand">${win?'DAY 81 · RESCUE':'SURVIVAL ENDED'}</div><div class="brand" style="font-size:34px">${win?'救援来了':'求生结束'}</div><div class="tagline">${win?'清晨，你被一种陌生的声音惊醒。不是风，也不是海浪。是船。':`DAY ${state.day}，${p.name}倒下了。<br>原因：${esc(p.deathCause||'生命归零')}`}</div><div class="score">${state.score}</div><div class="name">${title}</div><div class="tagline" style="margin:10px auto 18px">${txt}</div><section class="card" style="text-align:left"><div class="section-title">最终幸存者</div>${state.characters.map(c=>`<div class="row between ${c.dead?'dead':''}" style="padding:7px 0"><span>${c.avatar} ${c.name}</span><span>${c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:'获救'}</span></div>`).join('')}</section><button class="btn" onclick="Game.selectScreen()">再来一次</button><button class="btn ghost" onclick="Game.home()">返回首页</button></div>`}
  function renderPending(){const p=player();if(state.pending.type==='pick'){const opts=state.pending.choices.map(id=>`<button class="choice" onclick="Game.pickItem('${id}')">${item(id).ico} <b>${esc(item(id).name)}</b><small>${esc(item(id).desc)}</small></button>`).join('');document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>选择一件物资</h2><p class="muted">你只能带走其中一件。</p><div class="choices">${opts}</div></div></div>`);return}const id=state.pending.incoming,it=item(id);const old=p.inventory.map(x=>`<button class="choice" onclick="Game.replace('${x}')">丢弃 ${item(x).ico} ${esc(item(x).name)}</button>`).join('');document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="pending"><div class="modal"><h2>背包已满</h2><p>新获得：${it.ico} <b>${esc(it.name)}</b></p><p class="muted">必须丢弃一件旧道具，或放弃新道具。</p><div class="choices">${old}<button class="choice" onclick="Game.replace('__new__')">放弃 ${esc(it.name)}</button></div></div></div>`)}

  function modal(html){document.body.insertAdjacentHTML('beforeend',`<div class="modalWrap" id="modal"><div class="modal">${html}</div></div>`)}
  function closeModal(){document.getElementById('modal')?.remove()}
  function itemInfo(id){const it=item(id),p=player(),can=it.consumable&&(state.phase==='PREPARE'||state.phase==='POST');modal(`<div class="row between"><h2>${it.ico} ${esc(it.name)}</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><p>${esc(it.desc)}</p><div class="muted">${it.consumable?'消耗品':'携带生效 · 同名效果不叠加'}</div>${can?`<button class="btn" style="margin-top:14px" onclick="Game.use('${id}')">使用</button>`:''}`)}
  function survivors(){modal(`<div class="row between"><h2>幸存者</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="list">${state.characters.map(c=>`<div class="listItem ${c.dead?'dead':''}"><div class="row between"><b>${c.avatar} ${c.name} · ${c.job}</b><span>${c.dead?'已死亡':hearts(c)}</span></div><div class="meta">${c.dead?`DAY ${c.deathDay} · ${esc(c.deathCause)}`:`健康 ${healthDots(c)} · 背包${c.inventory.length}件`}</div></div>`).join('')}</div>`)}
  function logs(){modal(`<div class="row between"><h2>生存日志</h2><button class="btn small ghost" onclick="Game.closeModal()">关闭</button></div><div class="log">${state.history.length?state.history.slice().reverse().map(x=>`<div class="listItem"><b>DAY ${x.day}</b><br>${esc(x.msg)}</div>`).join(''):'还没有值得记录的事。'}</div>`)}
  function tradeModal(){const p=player(),o=cBy(state.encounter.a===p.id?state.encounter.b:state.encounter.a);if(!p.inventory.length){encounterAction('trade');return}if(!o.inventory.length){modal(`<h2>交易</h2><p>${o.name}没有道具。按荒岛规则，你需要免费给TA一件。</p>${p.inventory.map(id=>`<button class="choice" onclick="Game.tradeChoose('${id}')">给出 ${item(id).ico}${esc(item(id).name)}</button>`).join('')}<button class="btn ghost" onclick="Game.closeModal()">取消</button>`);return}modal(`<h2>选择你要拿来交换的道具</h2><p class="muted">对方会根据自己的需要拿出一件物品。</p>${p.inventory.map(id=>`<button class="choice" onclick="Game.tradeChoose('${id}')">${item(id).ico} ${esc(item(id).name)}</button>`).join('')}<button class="btn ghost" onclick="Game.closeModal()">取消</button>`)}

  function render(){document.querySelectorAll('.modalWrap').forEach(x=>x.remove());if(!state){renderHome();return}renderMain();if(state.pending&&!document.getElementById('pending'))renderPending()}

  window.Game={
    home(){state=null;renderHome()},
    selectScreen(){app.innerHTML='';renderSelect()},
    continueGame(){state=load();if(!state){renderHome();return}render()},
    start(id){if(load()&&!confirm('开始新游戏会覆盖旧存档，确定吗？'))return;state=newState(id);log(`${player().name}成为主角。DAY 1，求生开始。`);save();render()},
    draw:drawEvent,resolve:resolveInstantOrCheck,endDay,
    beginEncounter,encounter:encounterAction,closeEncounter,
    nextDay,itemInfo,survivors,logs,closeModal,
    use(id){closeModal();useItem(player(),id)},
    replace(oldId){const p=player(),incoming=state.pending.incoming;if(oldId!=='__new__'){const i=p.inventory.indexOf(oldId);if(i>=0)p.inventory.splice(i,1,incoming);toast(`丢弃${item(oldId).name}，留下${item(incoming).name}`)}else toast(`放弃${item(incoming).name}`);state.pending=null;save();render()},
    pickItem(id){state.pending=null;gainItem(player(),id,'选择获得');save();render()},
    tradeModal,tradeChoose(id){closeModal();encounterAction('trade',id)},
    restartAsk(){if(confirm('确定放弃当前进度并重新开始吗？')){localStorage.removeItem(SAVE);state=null;renderSelect()}},
  };
  async function boot(){
    try{
      const r=await fetch('/api/game-config',{cache:'no-store'});
      if(r.ok){const cfg=await r.json();GAME_CONFIG={roleNames:{...DEFAULT_GAME_CONFIG.roleNames,...(cfg.roleNames||{})},difficulty:{...DEFAULT_GAME_CONFIG.difficulty,...(cfg.difficulty||{})}};}
    }catch(e){console.warn('game config unavailable, using defaults',e)}
    applyNamesToCharacters(D.characters);
    renderHome();
  }
  boot();
})();
