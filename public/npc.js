window.DAY81_NPC = (() => {
  function itemValue(item, c, day){
    let v=item.value||5;
    if(item.kind==='food' && c.health<=1) v+=8;
    else if(item.kind==='food' && c.health===2) v+=3;
    if(item.kind==='medical' && c.life<=2) v+=7;
    if((item.mods?.combat||item.mods?.strCheck) && c.str>=4) v+=2;
    if(item.mods?.rescue && day>=60) v+=item.mods.rescue*3;
    return v;
  }
  function shouldUseFood(c){ const limit=Number(c.inventoryLimit||4); return c.health<=1 || (c.health===2 && c.inventory.length>=limit); }
  function chooseDiscard(c, data, day, incomingId){
    const ids=[...c.inventory,incomingId];
    let worst=ids[0], score=Infinity;
    for(const id of ids){ const s=itemValue(data.items[id],c,day); if(s<score){score=s;worst=id;} }
    return worst;
  }
  function eventChoice(c,event,data,rng){
    if(!event.choices) return 0;
    let best=0,bestScore=-999;
    event.choices.forEach((ch,i)=>{
      let score=0;
      if(ch.action==='none') score+=2;
      if(ch.stat) score+=(c[ch.stat]-3)*2;
      if(ch.risk==='危险') score-= c.id==='zhouye'?1:4;
      if(ch.risk==='安全') score+=2;
      if(c.id==='suqing' && ch.risk==='危险') score-=2;
      if(c.id==='xutang') score+=ch.action==='none'?1:0;
      score+=rng()*2;
      if(score>bestScore){bestScore=score;best=i;}
    });
    return best;
  }
  function encounterAction(c,other,data,rng,isEnemy){
    if(isEnemy) return rng()<.7?'avoid':'fight';
    const myPower=c.str+c.agi, op=other.str+other.agi;
    if(c.id==='zhouye' && myPower>=op+1 && rng()<.45) return 'fight';
    if(c.id==='xutang' && rng()<.65) return 'trade';
    if(c.health<=1 || c.life<=1) return 'avoid';
    return rng()<.62?'trade':(rng()<.72?'avoid':'fight');
  }
  return {itemValue,shouldUseFood,chooseDiscard,eventChoice,encounterAction};
})();
