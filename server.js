const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const MUSIC_DIR = path.join(ROOT, 'assets', 'music');
const DATA_DIR = process.env.ADMIN_DATA_DIR ? path.resolve(process.env.ADMIN_DATA_DIR) : path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'admin-config.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || '818181';
const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.m4a':'audio/mp4', '.aac':'audio/aac'
};

const DEFAULT_SETTINGS = {
  roleNames: {
    linlan:'林岚', zhouye:'周野', chenmo:'陈默', suqing:'苏晴', gaoyuan:'高远', xutang:'许棠'
  },
  difficulty: {
    nightEventChance: 0.70,
    baseCheckModifier: 0,
    healthDecayChance: 1.00,
    healthyLifeRecoverChance: 0.20,
    inventoryLimit: 8,
    startingBonusFood: 0,
    hostileBattleChance: 0.20,
    eventRecentWindow: 24,
    interactionRecentWindow: 24,
    bondThreshold: 60,
    npcSaveChanceDay30: 0.84,
    npcSaveChanceDay50: 0.66,
    npcSaveChanceDay60: 0.62
  },
  music: {
    tracks: [
      {id:'gentle_sea',label:'温柔的海风',file:'gentle_sea.wav',builtin:true},
      {id:'quiet_forest',label:'静谧森林',file:'quiet_forest.wav',builtin:true},
      {id:'under_stars',label:'星空之下',file:'under_stars.wav',builtin:true},
      {id:'morning_light',label:'晨曦之光',file:'morning_light.wav',builtin:true}
    ],
    enabledIds: ['gentle_sea','quiet_forest','under_stars','morning_light']
  }
};

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [salt, expectedHex] = String(stored || '').split(':');
    if (!salt || !expectedHex) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
function writeConfig(config){
  fs.mkdirSync(DATA_DIR, {recursive:true});
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
}
function normalizeMusic(rawMusic){
  const base=clone(DEFAULT_SETTINGS.music);
  const tracks=[...base.tracks];
  const seen=new Set(tracks.map(t=>t.id));
  if(Array.isArray(rawMusic?.tracks)){
    for(const t of rawMusic.tracks){
      if(!t||t.builtin) continue;
      const id=String(t.id||''); const file=path.basename(String(t.file||'')); const label=String(t.label||'').trim().slice(0,30);
      const ext=path.extname(file).toLowerCase();
      if(!/^custom_[a-f0-9]{8,32}$/.test(id)||seen.has(id)||!label||!['.wav','.mp3','.ogg','.m4a','.aac'].includes(ext)) continue;
      tracks.push({id,label,file,builtin:false}); seen.add(id);
    }
  }
  const requested=Array.isArray(rawMusic?.enabledIds)?rawMusic.enabledIds:base.enabledIds;
  const enabledIds=[...new Set(requested.map(String))].filter(id=>seen.has(id));
  return {tracks,enabledIds};
}
function normalizeConfig(raw){
  const out = { passwordHash: raw?.passwordHash || hashPassword(DEFAULT_PASSWORD), settings: clone(DEFAULT_SETTINGS) };
  if(raw?.settings?.roleNames){
    for(const id of Object.keys(out.settings.roleNames)){
      const n = raw.settings.roleNames[id];
      if(typeof n === 'string' && n.trim()) out.settings.roleNames[id] = n.trim().slice(0,12);
    }
  }
  if(raw?.settings?.difficulty){ for(const key of Object.keys(out.settings.difficulty)){ if(raw.settings.difficulty[key] !== undefined) out.settings.difficulty[key]=raw.settings.difficulty[key]; } }
  out.settings.difficulty.inventoryLimit = Math.max(8, Math.min(10, Number(out.settings.difficulty.inventoryLimit)||8));
  out.settings.music=normalizeMusic(raw?.settings?.music);
  return out;
}
function loadConfig(){
  fs.mkdirSync(DATA_DIR, {recursive:true});
  fs.mkdirSync(MUSIC_DIR, {recursive:true});
  if(!fs.existsSync(CONFIG_FILE)){
    const fresh = normalizeConfig(null); writeConfig(fresh); return fresh;
  }
  try { return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'))); }
  catch { const fresh=normalizeConfig(null); writeConfig(fresh); return fresh; }
}
let config = loadConfig();

function loadLeaderboard(){
  fs.mkdirSync(DATA_DIR,{recursive:true});
  if(!fs.existsSync(LEADERBOARD_FILE)) return [];
  try{
    const rows=JSON.parse(fs.readFileSync(LEADERBOARD_FILE,'utf8'));
    return Array.isArray(rows)?rows:[];
  }catch{return []}
}
function writeLeaderboard(rows){
  fs.mkdirSync(DATA_DIR,{recursive:true});
  const tmp=`${LEADERBOARD_FILE}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(rows,null,2),'utf8');
  fs.renameSync(tmp,LEADERBOARD_FILE);
}
function rankLeaderboard(rows){
  return [...rows].sort((a,b)=>
    (b.survivedDays-a.survivedDays)||
    (b.score-a.score)||
    (String(a.createdAt).localeCompare(String(b.createdAt)))
  ).slice(0,100).map((r,i)=>({...r,rank:i+1}));
}
function normalizeAccount(v){
  const s=String(v||'').trim();
  const chars=[...s];
  if(chars.length<6||chars.length>8) throw new Error('账号长度需为6—8个字符');
  if(!/^[\p{L}\p{N}_]+$/u.test(s)) throw new Error('账号只能使用中文、字母、数字或下划线');
  return s;
}
let leaderboard=loadLeaderboard();


const sessions = new Map();
const loginAttempts = new Map();
const SESSION_MS = 12 * 60 * 60 * 1000;
function cookies(req){
  const out={}; String(req.headers.cookie||'').split(';').forEach(part=>{const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}); return out;
}
function getSession(req){
  const token = cookies(req).day81_admin; if(!token) return null;
  const s=sessions.get(token); if(!s || s.expires<Date.now()){ if(token)sessions.delete(token); return null; }
  s.expires=Date.now()+SESSION_MS; return {token,...s};
}
function sessionCookie(req, token, maxAge=43200){
  const secure = String(req.headers['x-forwarded-proto']||'').toLowerCase()==='https';
  return `day81_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;
}
function json(res,status,data,extra={}){ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}); res.end(JSON.stringify(data)); }
function readBody(req){
  return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>50_000){reject(new Error('too_large'));req.destroy();}});req.on('end',()=>{try{resolve(body?JSON.parse(body):{})}catch{reject(new Error('bad_json'));}});req.on('error',reject);});
}
function readRawBody(req,maxBytes=25*1024*1024){
  return new Promise((resolve,reject)=>{const chunks=[];let size=0;req.on('data',c=>{size+=c.length;if(size>maxBytes){reject(new Error('too_large'));req.destroy();return;}chunks.push(c);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);});
}
function musicPublicTrack(t){return {id:t.id,label:t.label,src:`/assets/music/${encodeURIComponent(t.file)}`};}
function publicSettings(){
  const out=clone(config.settings);
  const music=config.settings.music||normalizeMusic(null);
  out.music={tracks:music.tracks.filter(t=>music.enabledIds.includes(t.id)&&fs.existsSync(path.join(MUSIC_DIR,t.file))).map(musicPublicTrack)};
  return out;
}
function validateSettings(input){
  const names=input?.roleNames||{}; const d=input?.difficulty||{};
  const roleNames={};
  for(const id of Object.keys(DEFAULT_SETTINGS.roleNames)){
    const n=String(names[id] ?? config.settings.roleNames[id] ?? '').trim();
    if(!n || n.length>12) throw new Error('角色姓名需为1—12个字符');
    if(/[<>]/.test(n)) throw new Error('角色姓名不能包含 < 或 >');
    roleNames[id]=n;
  }
  if(new Set(Object.values(roleNames)).size!==6) throw new Error('六位角色姓名不能重复');
  const num=(key,min,max,integer=false)=>{
    const v=Number(d[key]); if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v))) throw new Error(`${key} 数值无效`); return v;
  };
  return {roleNames,difficulty:{
    nightEventChance:num('nightEventChance',.10,.90),
    baseCheckModifier:num('baseCheckModifier',-.20,.20),
    healthDecayChance:num('healthDecayChance',.50,1.00),
    healthyLifeRecoverChance:num('healthyLifeRecoverChance',0,.60),
    inventoryLimit:num('inventoryLimit',8,10,true),
    startingBonusFood:num('startingBonusFood',0,3,true),
    hostileBattleChance:num('hostileBattleChance',0,.50),
    eventRecentWindow:num('eventRecentWindow',12,40,true),
    interactionRecentWindow:num('interactionRecentWindow',6,24,true),
    bondThreshold:num('bondThreshold',50,80,true),
    npcSaveChanceDay30:num('npcSaveChanceDay30',.30,.95),
    npcSaveChanceDay50:num('npcSaveChanceDay50',.15,.90),
    npcSaveChanceDay60:num('npcSaveChanceDay60',.10,.85)
  },music:clone(config.settings.music||normalizeMusic(null))};
}
function safeDecode(v){try{return decodeURIComponent(String(v||''));}catch{return String(v||'');}}
function clientIp(req){ return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim(); }
function canAttempt(ip){
  const now=Date.now(); let r=loginAttempts.get(ip); if(!r||r.reset<now){r={count:0,reset:now+10*60*1000};loginAttempts.set(ip,r);} return r.count<8;
}
function failedAttempt(ip){ const r=loginAttempts.get(ip)||{count:0,reset:Date.now()+10*60*1000};r.count++;loginAttempts.set(ip,r); }

async function handleApi(req,res,pathname){
  if(pathname==='/api/game-config' && req.method==='GET') return json(res,200,publicSettings());
  if(pathname==='/api/leaderboard' && req.method==='GET') return json(res,200,{ok:true,rows:rankLeaderboard(leaderboard)});
  if(pathname==='/api/leaderboard' && req.method==='POST'){
    let body; try{body=await readBody(req)}catch{return json(res,400,{ok:false,error:'请求格式错误'});}
    try{
      const account=normalizeAccount(body.account);
      const survivedDays=Number(body.survivedDays), score=Number(body.score);
      const difficulty=String(body.difficulty||'正常').slice(0,8);
      const character=String(body.character||'').trim().slice(0,12);
      if(!Number.isInteger(survivedDays)||survivedDays<1||survivedDays>81) throw new Error('幸存天数无效');
      if(!Number.isInteger(score)||score<0||score>100) throw new Error('得分无效');
      const entry={account,survivedDays,score,difficulty,character,createdAt:new Date().toISOString()};
      const oldIndex=leaderboard.findIndex(r=>r.account===account);
      if(oldIndex>=0){
        const old=leaderboard[oldIndex];
        const better=(entry.survivedDays>old.survivedDays)||(entry.survivedDays===old.survivedDays&&entry.score>old.score);
        if(better) leaderboard[oldIndex]=entry;
      }else leaderboard.push(entry);
      leaderboard=rankLeaderboard(leaderboard).map(({rank,...r})=>r);
      writeLeaderboard(leaderboard);
      const ranked=rankLeaderboard(leaderboard);
      const mine=ranked.find(r=>r.account===account)||null;
      return json(res,200,{ok:true,entry:mine,rows:ranked});
    }catch(e){return json(res,400,{ok:false,error:e.message||'提交失败'});}
  }
  if(pathname==='/api/admin/login' && req.method==='POST'){
    const ip=clientIp(req); if(!canAttempt(ip)) return json(res,429,{ok:false,error:'登录失败次数过多，请稍后再试。'});
    let body; try{body=await readBody(req)}catch{return json(res,400,{ok:false,error:'请求格式错误'});}
    if(!verifyPassword(String(body.password||''),config.passwordHash)){failedAttempt(ip);return json(res,401,{ok:false,error:'密码错误'});}
    loginAttempts.delete(ip); const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{expires:Date.now()+SESSION_MS});
    return json(res,200,{ok:true},{'Set-Cookie':sessionCookie(req,token)});
  }
  if(pathname==='/api/admin/logout' && req.method==='POST'){
    const s=getSession(req); if(s)sessions.delete(s.token); return json(res,200,{ok:true},{'Set-Cookie':sessionCookie(req,'',0)});
  }
  const session=getSession(req); if(!session) return json(res,401,{ok:false,error:'未登录或登录已过期'});
  if(pathname==='/api/admin/music' && req.method==='GET'){
    const music=config.settings.music||normalizeMusic(null);
    const tracks=music.tracks.map(t=>({...musicPublicTrack(t),builtin:!!t.builtin,file:t.file,enabled:music.enabledIds.includes(t.id),exists:fs.existsSync(path.join(MUSIC_DIR,t.file))}));
    return json(res,200,{ok:true,tracks});
  }
  if(pathname==='/api/admin/music/upload' && req.method==='POST'){
    const rawName=safeDecode(req.headers['x-file-name']);
    const rawLabel=safeDecode(req.headers['x-music-label']);
    const ext=path.extname(rawName).toLowerCase();
    if(!['.wav','.mp3','.ogg','.m4a','.aac'].includes(ext)) return json(res,400,{ok:false,error:'仅支持 WAV、MP3、OGG、M4A、AAC 音频'});
    let body; try{body=await readRawBody(req);}catch(e){return json(res,413,{ok:false,error:'音乐文件过大，单个文件请控制在25MB以内'});}
    if(!body.length) return json(res,400,{ok:false,error:'没有收到音乐文件'});
    const hex=crypto.randomBytes(6).toString('hex'); const id=`custom_${hex}`; const file=`custom-${Date.now()}-${hex}${ext}`;
    const label=(rawLabel||path.basename(rawName,ext)||'自定义音乐').trim().slice(0,30);
    fs.mkdirSync(MUSIC_DIR,{recursive:true}); fs.writeFileSync(path.join(MUSIC_DIR,file),body);
    config.settings.music=config.settings.music||normalizeMusic(null);config.settings.music.tracks.push({id,label,file,builtin:false});writeConfig(config);
    return json(res,200,{ok:true,track:{id,label,src:`/assets/music/${encodeURIComponent(file)}`,builtin:false,enabled:false}});
  }
  if(pathname==='/api/admin/music/enabled' && req.method==='PUT'){
    let body; try{body=await readBody(req)}catch{return json(res,400,{ok:false,error:'请求格式错误'});}
    const music=config.settings.music||normalizeMusic(null); const valid=new Set(music.tracks.map(t=>t.id));
    const enabledIds=[...new Set((Array.isArray(body.enabledIds)?body.enabledIds:[]).map(String))].filter(id=>valid.has(id));
    music.enabledIds=enabledIds;config.settings.music=music;writeConfig(config);return json(res,200,{ok:true,enabledIds});
  }
  if(pathname.startsWith('/api/admin/music/') && req.method==='DELETE'){
    const id=decodeURIComponent(pathname.slice('/api/admin/music/'.length)); const music=config.settings.music||normalizeMusic(null); const idx=music.tracks.findIndex(t=>t.id===id);
    if(idx<0) return json(res,404,{ok:false,error:'音乐不存在'}); const track=music.tracks[idx];
    if(track.builtin) return json(res,400,{ok:false,error:'内置音乐不能删除，可取消勾选使玩家不可见'});
    try{const fp=path.join(MUSIC_DIR,path.basename(track.file));if(fp.startsWith(MUSIC_DIR)&&fs.existsSync(fp))fs.unlinkSync(fp);}catch{}
    music.tracks.splice(idx,1);music.enabledIds=music.enabledIds.filter(x=>x!==id);config.settings.music=music;writeConfig(config);return json(res,200,{ok:true});
  }
  if(pathname==='/api/admin/settings' && req.method==='GET') return json(res,200,{ok:true,settings:publicSettings()});
  if(pathname==='/api/admin/settings' && req.method==='PUT'){
    let body; try{body=await readBody(req)}catch{return json(res,400,{ok:false,error:'请求格式错误'});}
    try{config.settings=validateSettings(body.settings||body);writeConfig(config);return json(res,200,{ok:true,settings:publicSettings()});}
    catch(e){return json(res,400,{ok:false,error:e.message||'设置无效'});}
  }
  if(pathname==='/api/admin/password' && req.method==='POST'){
    let body; try{body=await readBody(req)}catch{return json(res,400,{ok:false,error:'请求格式错误'});}
    const current=String(body.currentPassword||''), next=String(body.newPassword||'');
    if(!verifyPassword(current,config.passwordHash)) return json(res,400,{ok:false,error:'当前密码不正确'});
    if(next.length<6||next.length>64) return json(res,400,{ok:false,error:'新密码长度需为6—64个字符'});
    config.passwordHash=hashPassword(next);writeConfig(config);sessions.clear();
    return json(res,200,{ok:true,message:'密码已修改，请重新登录'},{'Set-Cookie':sessionCookie(req,'',0)});
  }
  return json(res,404,{ok:false,error:'Not found'});
}

function serveStatic(req,res,pathname){
  if(pathname==='/' ) pathname='/index.html';
  if(pathname==='/admin' || pathname==='/admin/') pathname='/admin.html';
  let file=path.normalize(path.join(ROOT,pathname));
  if(!file.startsWith(ROOT)){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()) file=path.join(ROOT,'index.html');
    fs.readFile(file,(readErr,data)=>{
      if(readErr){res.writeHead(500);return res.end('Server error');}
      res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
    });
  });
}

http.createServer(async (req,res)=>{
  let pathname; try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{pathname='/';}
  if(pathname.startsWith('/api/')) return handleApi(req,res,pathname);
  return serveStatic(req,res,pathname);
}).listen(PORT,'0.0.0.0',()=>console.log(`DAY 81 running on port ${PORT}`));
