/** 《八十一天》近似平衡模拟器。默认每名角色 10000 局。 */
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
  let life=c.max, health=3, foods=1, meds=c.id==='linlan'?1:0, death=81, linCd=0;
  for(let day=1;day<=80;day++){
    // 晨间/准备：理性玩家在健康较低时使用食物，平均恢复约1.55
    if(health<=1&&foods>0){health=Math.min(3,health+(R()<.55?2:1));if(!(c.id==='gaoyuan'&&R()<.25))foods--}
    if(life<=Math.max(1,c.max-2)&&meds>0){life=Math.min(c.max,life+1);meds--}
    if(c.id==='linlan'&&life===1&&linCd<=0&&R()<.30){life=Math.min(c.max,life+1);linCd=5}
    if(linCd>0)linCd--;
    const dayStartHealth=health;

    // 白天卡牌的近似分布。食物是核心资源，前期更多，后期逐渐减少。
    const foodP=day<=20?.56:day<=40?.54:day<=60?.51:.48;
    const x=R();
    if(x<foodP) foods++;
    else if(x<foodP+.15) health=Math.min(3,health+1);
    else if(x<foodP+.20) meds++;
    else if(x<foodP+.28) health=Math.max(0,health-1);
    else if(x<foodP+.305){ // 少量真正伤生命的事件，多数可用敏捷/技能规避
      let avoid=.60+(c.agi-3)*.055+(c.luck-4)*.025;if(c.id==='xutang')avoid+=.08;if(c.id==='chenmo')avoid+=.03;
      if(R()>avoid && !(c.id==='zhouye'&&R()<.25)) life--;
    }

    // 每5天遭遇一次，但主角只有约1/3概率被抽中；正常策略以交易/躲避为主。
    if(day>1&&(day-1)%5===0&&R()<.34){
      let safe=(c.id==='suqing'?.88:.81)+(c.agi-3)*.018;if(c.id==='xutang')safe+=.05;
      if(R()>safe && !(c.id==='zhouye'&&R()<.25)) life--;
    }

    // 夜间只有50%触发；45%负面、30%中性、25%正面。
    if(R()<.50){
      const n=R();
      if(n<.20) health=Math.max(0,health-1);
      else if(n<.225){if(!(c.id==='zhouye'&&R()<.25))life--;}
      else if(n>.75) health=Math.min(3,health+1);
    }
    if(life<=0){death=day;break}

    // 每日健康结算：健康已经为0时再过一天扣生命；否则健康-1。
    if(dayStartHealth===0 && health===0) life--; else if(health>0) health--; 
    if(life<=0){death=day;break}
  }
  return {win:life>0,death};
}
const games=Number(process.argv[2]||10000);let total=0;
for(const c of chars){let wins=0,deathSum=0;for(let i=0;i<games;i++){const z=run(c);if(z.win)wins++;else deathSum+=z.death}total+=wins;const losses=games-wins;console.log(`${c.name}: 胜率 ${(wins/games*100).toFixed(1)}% | 失败局平均死亡日 ${losses?(deathSum/losses).toFixed(1):'-'}`)}
console.log(`\n六角色平均胜率：${(total/(games*chars.length)*100).toFixed(1)}%`);
console.log('说明：这是近似压力测试，真人策略与完整卡牌效果会使结果产生波动。');
