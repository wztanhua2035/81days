/** 《八十一天》v1.4 近似平衡模拟器。默认每名角色 10000 局，仅用于估算正常难度压力。 */
const chars=[
  {id:'linlan',name:'林岚',max:3,agi:3,luck:4},
  {id:'zhouye',name:'周野',max:5,agi:3,luck:4},
  {id:'chenmo',name:'陈默',max:4,agi:2,luck:4},
  {id:'suqing',name:'苏晴',max:4,agi:5,luck:4},
  {id:'gaoyuan',name:'高远',max:4,agi:2,luck:5},
  {id:'xutang',name:'许棠',max:3,agi:3,luck:5}
];
const R=Math.random;
function run(c){
  let life=c.max,health=3,foods=2,meds=c.id==='linlan'?1:0,death=81,linCd=0,goodStreak=0;
  let shelter=false,water=false,trap=false;
  for(let day=1;day<=80;day++){
    if(day>=18&&R()<.08)shelter=true;if(day>=25&&R()<.06)water=true;if(day>=30&&R()<.05)trap=true;
    if(trap&&day%4===0)foods++;
    if(health<=1&&foods>0){health=Math.min(3,health+(R()<.60?2:1));if(!(c.id==='gaoyuan'&&R()<.25))foods--;}
    if(life<=Math.max(1,c.max-2)&&meds>0){life=Math.min(c.max,life+1);meds--;}
    if(c.id==='linlan'&&life===1&&linCd<=0&&R()<.30){life=Math.min(c.max,life+1);linCd=5;}if(linCd>0)linCd--;
    const dayStartHealth=health;

    // 地点探索 + 剧情链/营地使资源比旧版略稳定。
    const foodP=day<=20?.44:day<=40?.41:day<=60?.38:.35;
    const x=R();
    if(x<foodP)foods++;
    else if(x<foodP+.16)health=Math.min(3,health+1);
    else if(x<foodP+.22)meds++;
    else if(x<foodP+.30)health=Math.max(0,health-1);
    else if(x<foodP+.335){let avoid=.68+(c.agi-3)*.045+(c.luck-4)*.02;if(c.id==='xutang')avoid+=.06;if(R()>avoid&&!(c.id==='zhouye'&&R()<.25))life--;}

    // 同地点相遇平均约三成多，但理性玩家多交易/躲避，生命伤害很低。
    if(R()<.34){let safe=.91+(c.id==='suqing'?.035:0)+(c.agi-3)*.008;if(R()>safe&&!(c.id==='zhouye'&&R()<.25))life--;}

    // 70% 夜间特别事件；正面/中性事件和营地保护使其不等于70%伤害。
    if(R()<.70){const n=R();if(n<.19&&!shelter)health=Math.max(0,health-1);else if(n<.215&&!shelter){if(!(c.id==='zhouye'&&R()<.25))life--;}else if(n>.72)health=Math.min(3,health+1);}

    // 四次大危机，有提前准备；只造成温和的额外压力。
    if([23,40,55,71].includes(day)&&R()<.28&&!shelter)health=Math.max(0,health-1);
    if(life<=0){death=day;break;}

    let decay=.95;if(water)decay-=.08;
    if(dayStartHealth===0&&health===0)life--;else if(health>0&&R()<decay)health--;
    if(health>=2)goodStreak++;else goodStreak=0;if(goodStreak>=3){if(R()<.23)life=Math.min(c.max,life+1);goodStreak=0;}
    if(life<=0){death=day;break;}
  }
  return {win:life>0,death};
}
const games=Number(process.argv[2]||10000);let total=0;
for(const c of chars){let wins=0,deathSum=0;for(let i=0;i<games;i++){const z=run(c);if(z.win)wins++;else deathSum+=z.death;}total+=wins;const losses=games-wins;console.log(`${c.name}: 胜率 ${(wins/games*100).toFixed(1)}% | 失败局平均死亡日 ${losses?(deathSum/losses).toFixed(1):'-'}`);}
console.log(`\n六角色平均胜率：${(total/(games*chars.length)*100).toFixed(1)}%`);
console.log('说明：这是近似压力测试，剧情选择、关系互助、营地建设速度和真实卡牌组合会让真人结果产生波动。');
