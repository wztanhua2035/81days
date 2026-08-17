(() => {
  const ids=['linlan','zhouye','chenmo','suqing','gaoyuan','xutang'];
  const labels={linlan:'急诊护士',zhouye:'消防员',chenmo:'机械工程师',suqing:'户外摄影师',gaoyuan:'餐厅厨师',xutang:'中学教师'};
  const standard={nightEventChance:.70,baseCheckModifier:0,healthDecayChance:1,healthyLifeRecoverChance:.20,inventoryLimit:8,startingBonusFood:0,hostileBattleChance:.20,eventRecentWindow:24,interactionRecentWindow:24,bondThreshold:60,npcSaveChanceDay30:.84,npcSaveChanceDay50:.66,npcSaveChanceDay60:.62};
  const $=id=>document.getElementById(id);
  const pct=x=>Math.round(Number(x)*100);
  const unpct=x=>Number(x)/100;
  function msg(id,text,type=''){const el=$(id);el.textContent=text||'';el.className=`msg ${type}`}
  async function api(url,options={}){
    const headers={...(options.headers||{})};
    if(options.body!==undefined&&!headers['Content-Type']&&!options.raw)headers['Content-Type']='application/json';
    const opts={cache:'no-store',...options,headers};delete opts.raw;
    const r=await fetch(url,opts);let data={};try{data=await r.json()}catch{}
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
    $('hostileBattleChance').value=pct(d.hostileBattleChance);$('eventRecentWindow').value=d.eventRecentWindow;$('interactionRecentWindow').value=d.interactionRecentWindow;$('bondThreshold').value=d.bondThreshold;
    $('npcSaveChanceDay30').value=pct(d.npcSaveChanceDay30);$('npcSaveChanceDay50').value=pct(d.npcSaveChanceDay50);$('npcSaveChanceDay60').value=pct(d.npcSaveChanceDay60);
  }
  function collect(){return {roleNames:Object.fromEntries(ids.map(id=>[id,$(`role_${id}`).value.trim()])),difficulty:{nightEventChance:unpct($('nightEventChance').value),baseCheckModifier:unpct($('baseCheckModifier').value),healthDecayChance:unpct($('healthDecayChance').value),healthyLifeRecoverChance:unpct($('healthyLifeRecoverChance').value),inventoryLimit:Number($('inventoryLimit').value),startingBonusFood:Number($('startingBonusFood').value),hostileBattleChance:unpct($('hostileBattleChance').value),eventRecentWindow:Number($('eventRecentWindow').value),interactionRecentWindow:Number($('interactionRecentWindow').value),bondThreshold:Number($('bondThreshold').value),npcSaveChanceDay30:unpct($('npcSaveChanceDay30').value),npcSaveChanceDay50:unpct($('npcSaveChanceDay50').value),npcSaveChanceDay60:unpct($('npcSaveChanceDay60').value)}}}
  async function loadMusic(){
    try{const d=await api('/api/admin/music');renderMusic(d.tracks||[]);}catch(e){if(e.status===401){showLogin();return;}msg('musicMsg',e.message,'error')}
  }
  function renderMusic(tracks){
    $('musicList').innerHTML=tracks.length?tracks.map(t=>`<div class="music-row ${t.exists?'':'missing'}"><label class="music-check"><input type="checkbox" class="musicEnabled" value="${escapeHtml(t.id)}" ${t.enabled?'checked':''} ${t.exists?'':'disabled'}><span><b>${escapeHtml(t.label)}</b><small>${t.builtin?'内置音乐':escapeHtml(t.file)}${t.exists?'':' · 文件缺失'}</small></span></label><audio controls preload="none" src="${escapeHtml(t.src)}"></audio>${t.builtin?'<span class="builtin-tag">内置</span>':`<button class="danger-mini" type="button" onclick="AdminMusic.remove('${escapeHtml(t.id)}')">删除</button>`}</div>`).join(''):'<div class="muted">暂无背景音乐。</div>';
  }
  async function uploadMusic(){
    const file=$('musicFile').files?.[0];if(!file){msg('musicMsg','请先选择音乐文件。','error');return;}
    const label=$('musicLabel').value.trim()||file.name.replace(/\.[^.]+$/,'');
    $('musicUploadBtn').disabled=true;msg('musicMsg','正在上传……');
    try{await api('/api/admin/music/upload',{method:'POST',raw:true,headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Music-Label':encodeURIComponent(label)},body:await file.arrayBuffer()});$('musicFile').value='';$('musicLabel').value='';msg('musicMsg','上传完成。勾选后点击“保存可用曲目”，玩家才会看到。','ok');await loadMusic();}
    catch(e){msg('musicMsg',e.message,'error')}finally{$('musicUploadBtn').disabled=false;}
  }
  async function saveMusicEnabled(){
    const enabledIds=[...document.querySelectorAll('.musicEnabled:checked')].map(x=>x.value);$('musicSaveBtn').disabled=true;
    try{await api('/api/admin/music/enabled',{method:'PUT',body:JSON.stringify({enabledIds})});msg('musicMsg','已保存。玩家刷新游戏后只会看到勾选的背景音乐。','ok');await loadMusic();}
    catch(e){msg('musicMsg',e.message,'error')}finally{$('musicSaveBtn').disabled=false;}
  }
  async function removeMusic(id){if(!confirm('确定删除这首自定义背景音乐吗？'))return;try{await api('/api/admin/music/'+encodeURIComponent(id),{method:'DELETE'});msg('musicMsg','已删除。','ok');await loadMusic();}catch(e){msg('musicMsg',e.message,'error')}}
  async function loadSettings(){
    try{const d=await api('/api/admin/settings');renderRoles(d.settings.roleNames);fillDifficulty(d.settings.difficulty);showAdmin();await loadMusic();}
    catch(e){if(e.status===401)showLogin();else{showLogin();msg('loginMsg',e.message,'error')}}
  }
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg('loginMsg','');try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('loginPassword').value})});$('loginPassword').value='';await loadSettings()}catch(err){msg('loginMsg',err.message,'error')}});
  $('saveBtn').addEventListener('click',async()=>{msg('saveMsg','');$('saveBtn').disabled=true;try{const d=await api('/api/admin/settings',{method:'PUT',body:JSON.stringify({settings:collect()})});renderRoles(d.settings.roleNames);fillDifficulty(d.settings.difficulty);msg('saveMsg','已保存。角色姓名刷新游戏页面后更新；难度参数对新开局生效。','ok')}catch(err){if(err.status===401){showLogin();return}msg('saveMsg',err.message,'error')}finally{$('saveBtn').disabled=false}});
  $('resetBtn').addEventListener('click',()=>{fillDifficulty(standard);msg('saveMsg','已恢复表单中的标准难度；点击“保存”后才会生效。')});
  $('passwordBtn').addEventListener('click',async()=>{msg('passwordMsg','');const a=$('currentPassword').value,b=$('newPassword').value,c=$('confirmPassword').value;if(b!==c){msg('passwordMsg','两次输入的新密码不一致。','error');return}try{const d=await api('/api/admin/password',{method:'POST',body:JSON.stringify({currentPassword:a,newPassword:b})});msg('passwordMsg',d.message||'密码已修改','ok');setTimeout(showLogin,700);$('currentPassword').value=$('newPassword').value=$('confirmPassword').value=''}catch(err){msg('passwordMsg',err.message,'error')}});
  $('logoutBtn').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',body:'{}'})}catch{}showLogin()});
  $('musicUploadBtn').addEventListener('click',uploadMusic);
  $('musicSaveBtn').addEventListener('click',saveMusicEnabled);
  window.AdminMusic={remove:removeMusic};
  loadSettings();
})();
