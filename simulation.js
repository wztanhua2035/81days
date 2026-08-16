/** 《八十一天》v2.1 近似平衡回归测试。
 * 普通难度目标：在原约50%的基础上略微提高；NPC DAY30前死亡率<20%，DAY50前<50%。
 * 这是简化压力模型，用于调参回归，不代替上线后的真实玩家统计。
 */
const chars=[
  {id:'linlan',name:'林岚',max:3,agi:3,luck:4},
  {id:'zhouye',name:'周野',max:5,agi:3,luck:4},
  {id:'chenmo',name:'陈默',max:4,agi:2,luck:4},
  {id:'suqing',name:'苏晴',max:4,agi:5,luck:4},
  {id:'gaoyuan',name:'高远',max:4,agi:2,luck:5},
  {id:'xutang',name:'许棠',max:4,agi:3,luck:5}
];
const R=Math.random;
function gainHealth(s,n){const target=s.health+n;if(target<=3)s.health=target;else if(s.life<s.max){s.life++;s.health=1;}else s.health=3;}
function saveNpc(s,day,npc){if(!npc||s.life>0)return;const p=day<=30?.82:day<=50?.52:0;if(p&&R()<p)s.life=1;}
function run(c,npc=false){
  const s={life:c.max,max:c.max,health:3,foods:1,meds:c.id==='linlan'?1:0,linCd:0,streak:0,death:81};
  let shelter=false,water=false,trap=false;
  for(let day=1;day<=80;day++){
    if(day>=18&&R()<.08)shelter=true;if(day>=25&&R()<.06)water=true;if(day>=30&&R()<.05)trap=true;if(trap&&day%4===0)s.foods++;
    if(s.health<=1&&s.foods>0){gainHealth(s,R()<.60?2:1);if(!(c.id==='gaoyuan'&&R()<.25))s.foods--;}
    if(s.life<=Math.max(1,c.max-2)&&s.meds>0){s.life=Math.min(c.max,s.life+1);s.meds--;}
    if(c.id==='linlan'&&s.life===1&&s.linCd<=0&&R()<.30){s.life=Math.min(c.max,s.life+1);s.linCd=5;}if(s.linCd>0)s.linCd--;
    const dayStart=s.health;

    // 一次地点探索：资源前期略多，后期逐步收紧。
    const foodP=day<=20?.443:day<=40?.413:day<=60?.383:.353;
    const x=R();
    if(x<foodP)s.foods++;
    else if(x<foodP+.16)gainHealth(s,1);
    else if(x<foodP+.22)s.meds++;
    else if(x<foodP+.30)s.health=Math.max(0,s.health-1);
    else if(x<foodP+.335){let avoid=.68+(c.agi-3)*.045+(c.luck-4)*.02;if(c.id==='xutang')avoid+=.06;if(R()>avoid&&!(c.id==='zhouye'&&R()<.25))s.life--;}

    // 人物互动多为关系与小收益；敌对冲突概率低。
    if(R()<.32&&R()<.038&&!(c.id==='zhouye'&&R()<.25))s.life--;

    // 默认70%夜间特别事件，并非所有事件都会命中该地点或造成损失。
    if(R()<.695){const n=R();if(n<.19&&!shelter)s.health=Math.max(0,s.health-1);else if(n<.215&&!shelter){if(!(c.id==='zhouye'&&R()<.25))s.life--;}else if(n>.72)gainHealth(s,1);}
    if([23,40,55,71].includes(day)&&R()<.28&&!shelter)s.health=Math.max(0,s.health-1);
    saveNpc(s,day,npc);if(s.life<=0){s.death=day;break;}

    let decay=.985;if(water)decay-=.08;
    if(dayStart===0&&s.health===0)s.life--;else if(s.health>0&&R()<decay)s.health--;
    if(s.health>=2)s.streak++;else s.streak=0;if(s.streak>=3){if(R()<.21)s.life=Math.min(c.max,s.life+1);s.streak=0;}
    saveNpc(s,day,npc);if(s.life<=0){s.death=day;break;}
  }
  return {win:s.life>0,death:s.death};
}
const games=Number(process.argv[2]||20000);let total=0;
console.log(`每个角色模拟 ${games} 局（普通难度）\n`);
for(const c of chars){let wins=0,npc30=0,npc50=0,deathSum=0,loss=0;for(let i=0;i<games;i++){
  const p=run(c,false);if(p.win)wins++;else{loss++;deathSum+=p.death;}
  const n=run(c,true);if(!n.win&&n.death<=30)npc30++;if(!n.win&&n.death<=50)npc50++;
}total+=wins;console.log(`${c.name}: 玩家胜率 ${(wins/games*100).toFixed(1)}% | NPC≤30天死亡 ${(npc30/games*100).toFixed(1)}% | NPC≤50天死亡 ${(npc50/games*100).toFixed(1)}% | 失败平均日 ${loss?(deathSum/loss).toFixed(1):'-'}`);}
console.log(`\n玩家六角色平均通关率：${(total/(games*chars.length)*100).toFixed(1)}%`);
console.log('目标：较旧版略有提升；NPC≤30天<20%，NPC≤50天<50%。');
