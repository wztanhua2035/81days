(() => {
  const ids=['linlan','zhouye','chenmo','suqing','gaoyuan','xutang'];
  const labels={linlan:'急诊护士',zhouye:'消防员',chenmo:'机械工程师',suqing:'户外摄影师',gaoyuan:'餐厅厨师',xutang:'中学教师'};
  const standard={nightEventChance:.70,baseCheckModifier:0,healthDecayChance:1,healthyLifeRecoverChance:.20,inventoryLimit:8,startingBonusFood:0};
  const $=id=>document.getElementById(id);
  const pct=x=>Math.round(Number(x)*100);
  const unpct=x=>Number(x)/100;
  function msg(id,text,type=''){const el=$(id);el.textContent=text||'';el.className=`msg ${type}`}
  async function api(url,options={}){
    const r=await fetch(url,{cache:'no-store',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok){const e=new Error(data.error||'请求失败');e.status=r.status;throw e}return data;
  }
  function showLogin(){ $('loginView').classList.remove('hidden');$('adminView').classList.add('hidden'); }
  function showAdmin(){ $('loginView').classList.add('hidden');$('adminView').classList.remove('hidden'); }
  function renderRoles(names){$('roleFields').innerHTML=ids.map(id=>`<label>${labels[id]}<input id="role_${id}" maxlength="12" value="${escapeHtml(names[id]||'')}" /></label>`).join('')}
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function fillDifficulty(d){
    $('nightEventChance').value=pct(d.nightEventChance);$('baseCheckModifier').value=pct(d.baseCheckModifier);
    $('healthDecayChance').value=pct(d.healthDecayChance);$('healthyLifeRecoverChance').value=pct(d.healthyLifeRecoverChance);
    $('inventoryLimit').value=d.inventoryLimit;$('startingBonusFood').value=d.startingBonusFood;
  }
  function collect(){return {roleNames:Object.fromEntries(ids.map(id=>[id,$(`role_${id}`).value.trim()])),difficulty:{nightEventChance:unpct($('nightEventChance').value),baseCheckModifier:unpct($('baseCheckModifier').value),healthDecayChance:unpct($('healthDecayChance').value),healthyLifeRecoverChance:unpct($('healthyLifeRecoverChance').value),inventoryLimit:Number($('inventoryLimit').value),startingBonusFood:Number($('startingBonusFood').value)}}}
  async function loadSettings(){
    try{const d=await api('/api/admin/settings');renderRoles(d.settings.roleNames);fillDifficulty(d.settings.difficulty);showAdmin();}
    catch(e){if(e.status===401)showLogin();else{showLogin();msg('loginMsg',e.message,'error')}}
  }
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg('loginMsg','');try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('loginPassword').value})});$('loginPassword').value='';await loadSettings()}catch(err){msg('loginMsg',err.message,'error')}});
  $('saveBtn').addEventListener('click',async()=>{msg('saveMsg','');$('saveBtn').disabled=true;try{const d=await api('/api/admin/settings',{method:'PUT',body:JSON.stringify({settings:collect()})});renderRoles(d.settings.roleNames);fillDifficulty(d.settings.difficulty);msg('saveMsg','已保存。角色姓名刷新游戏页面后更新；难度参数对新开局生效。','ok')}catch(err){if(err.status===401){showLogin();return}msg('saveMsg',err.message,'error')}finally{$('saveBtn').disabled=false}});
  $('resetBtn').addEventListener('click',()=>{fillDifficulty(standard);msg('saveMsg','已恢复表单中的标准难度；点击“保存”后才会生效。')});
  $('passwordBtn').addEventListener('click',async()=>{msg('passwordMsg','');const a=$('currentPassword').value,b=$('newPassword').value,c=$('confirmPassword').value;if(b!==c){msg('passwordMsg','两次输入的新密码不一致。','error');return}try{const d=await api('/api/admin/password',{method:'POST',body:JSON.stringify({currentPassword:a,newPassword:b})});msg('passwordMsg',d.message||'密码已修改','ok');setTimeout(showLogin,700);$('currentPassword').value=$('newPassword').value=$('confirmPassword').value=''}catch(err){msg('passwordMsg',err.message,'error')}});
  $('logoutBtn').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',body:'{}'})}catch{}showLogin()});
  loadSettings();
})();
