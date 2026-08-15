window.DAY81_DATA = (() => {
  const characters = [
    {id:'linlan',name:'林岚',sex:'女',age:29,job:'急诊护士',avatar:'🩺',maxLife:3,str:2,agi:3,int:5,luck:4,startItem:'first_aid',ability:'急救本能：生命降到1后，从次日早晨起30%概率恢复1点生命；成功后冷却5天。'},
    {id:'zhouye',name:'周野',sex:'男',age:34,job:'消防员',avatar:'🧯',maxLife:5,str:5,agi:3,int:2,luck:4,startItem:'rope',ability:'硬汉：危险事件或战斗造成生命伤害时，25%概率抵消1点。'},
    {id:'chenmo',name:'陈默',sex:'男',age:41,job:'机械工程师',avatar:'🔧',maxLife:4,str:3,agi:2,int:5,luck:4,startItem:'multitool',ability:'修理专家：非消耗道具损坏时35%概率修复。'},
    {id:'suqing',name:'苏晴',sex:'女',age:26,job:'户外摄影师',avatar:'📷',maxLife:4,str:2,agi:5,int:3,luck:4,startItem:'compass',ability:'观察者：选择事件会显示风险提示；人物遭遇躲避成功率提升至35%。'},
    {id:'gaoyuan',name:'高远',sex:'男',age:38,job:'餐厅厨师',avatar:'🍳',maxLife:4,str:4,agi:2,int:3,luck:5,startItem:'canned',ability:'精打细算：使用食品时25%概率产生效果但不消耗。'},
    {id:'xutang',name:'许棠',sex:'女',age:32,job:'中学教师',avatar:'📚',maxLife:3,str:2,agi:3,int:4,luck:5,startItem:'notebook',ability:'冷静判断：每7天获得一次非战斗属性检定重试。'}
  ];

  const items = {
    apple:{id:'apple',name:'苹果',ico:'🍎',kind:'food',consumable:true,value:5,desc:'健康+1',effect:{health:1}},
    coconut:{id:'coconut',name:'椰子',ico:'🥥',kind:'food',consumable:true,value:6,desc:'健康+1，20%概率额外+1',effect:{health:1,extraHealthChance:.2}},
    canned:{id:'canned',name:'罐头',ico:'🥫',kind:'food',consumable:true,value:9,desc:'健康+2',effect:{health:2}},
    biscuit:{id:'biscuit',name:'压缩饼干',ico:'🍘',kind:'food',consumable:true,value:9,desc:'健康+1，今晚不自然下降',effect:{health:1,skipDecay:true}},
    grilled_fish:{id:'grilled_fish',name:'烤鱼',ico:'🐟',kind:'food',consumable:true,value:8,desc:'健康+2',effect:{health:2}},
    berries:{id:'berries',name:'野果',ico:'🫐',kind:'food',consumable:true,value:4,desc:'75%健康+1，25%健康-1',effect:{wildFood:true}},
    first_aid:{id:'first_aid',name:'急救包',ico:'🩹',kind:'medical',consumable:true,value:10,desc:'生命+1',effect:{life:1}},
    painkiller:{id:'painkiller',name:'止痛药',ico:'💊',kind:'medical',consumable:true,value:7,desc:'下一次生命伤害-1',effect:{shield:1}},
    disinfectant:{id:'disinfectant',name:'消毒药水',ico:'🧴',kind:'medical',consumable:true,value:7,desc:'抵消下一次健康或生命损失1点',effect:{generalShield:1}},
    dagger:{id:'dagger',name:'匕首',ico:'🗡️',kind:'gear',consumable:false,value:9,desc:'战斗攻击力+1',mods:{combat:1}},
    spear:{id:'spear',name:'木矛',ico:'🔱',kind:'gear',consumable:false,value:8,desc:'力量检定+1；战斗攻击力+1（武器不叠加）',mods:{strCheck:1,combat:1,weapon:true}},
    rope:{id:'rope',name:'救援绳',ico:'🪢',kind:'gear',consumable:false,value:8,desc:'攀爬、悬崖、救援成功率+25%',mods:{climb:.25}},
    multitool:{id:'multitool',name:'多功能工具钳',ico:'🛠️',kind:'gear',consumable:false,value:9,desc:'机械知识类事件成功率+20%',mods:{mechanic:.2}},
    compass:{id:'compass',name:'指南针',ico:'🧭',kind:'gear',consumable:false,value:8,desc:'迷路类事件自动成功',mods:{navigation:true}},
    flashlight:{id:'flashlight',name:'手电筒',ico:'🔦',kind:'gear',consumable:false,value:8,desc:'夜间负面事件概率下降',mods:{nightSafe:.15}},
    torch:{id:'torch',name:'火把',ico:'🔥',kind:'gear',consumable:false,value:8,desc:'抵挡野兽伤害；使用后30%概率损坏',mods:{beastSafe:true}},
    lighter:{id:'lighter',name:'打火机',ico:'🧨',kind:'gear',consumable:false,value:8,desc:'生火、取暖、驱赶动物类事件+30%',mods:{fire:.3}},
    tarp:{id:'tarp',name:'雨布',ico:'⛺',kind:'gear',consumable:false,value:9,desc:'暴雨类健康损失无效',mods:{rainSafe:true}},
    bottle:{id:'bottle',name:'水壶',ico:'🚰',kind:'gear',consumable:false,value:8,desc:'缺水、寻找淡水事件+25%',mods:{water:.25}},
    fishing:{id:'fishing',name:'捕鱼线',ico:'🎣',kind:'gear',consumable:false,value:7,desc:'捕鱼成功率+30%',mods:{fish:.3}},
    axe:{id:'axe',name:'小斧头',ico:'🪓',kind:'gear',consumable:false,value:8,desc:'力量资源事件+20%',mods:{resource:.2}},
    drybag:{id:'drybag',name:'防水布袋',ico:'🎒',kind:'gear',consumable:false,value:8,desc:'暴雨或落水不会随机丢失道具',mods:{dry:true}},
    whistle:{id:'whistle',name:'哨子',ico:'📣',kind:'special',consumable:false,value:6,desc:'DAY61后提高求救相关事件权重',mods:{rescue:1}},
    mirror:{id:'mirror',name:'信号镜',ico:'🪞',kind:'special',consumable:false,value:9,desc:'DAY61后提高求救相关事件权重',mods:{rescue:2}},
    flare:{id:'flare',name:'信号弹',ico:'🚀',kind:'special',consumable:true,value:10,desc:'DAY61后使用可增加求救评分',effect:{rescueScore:2}},
    oldmap:{id:'oldmap',name:'旧地图',ico:'🗺️',kind:'gear',consumable:false,value:6,desc:'探索知识检定获得小幅加成',mods:{explore:.12}},
    binoculars:{id:'binoculars',name:'望远镜',ico:'🔭',kind:'gear',consumable:false,value:8,desc:'危险选择会得到额外提示',mods:{riskHint:true}},
    raincoat:{id:'raincoat',name:'破旧雨衣',ico:'🧥',kind:'gear',consumable:false,value:6,desc:'第一次暴雨健康伤害自动抵消，随后损坏',mods:{rainOnce:true}},
    coin:{id:'coin',name:'幸运硬币',ico:'🪙',kind:'gear',consumable:false,value:7,desc:'幸运检定+10%',mods:{luck:.1}},
    notebook:{id:'notebook',name:'防水笔记本',ico:'📓',kind:'gear',consumable:false,value:6,desc:'记录求生过程；最终评分略有加成',mods:{journal:true}},
    lifevest:{id:'lifevest',name:'救生衣',ico:'🦺',kind:'gear',consumable:false,value:7,desc:'下一次落水生命伤害免除',mods:{waterShield:true}}
  };

  const itemPool = Object.keys(items);
  const foodPool = itemPool.filter(id=>items[id].kind==='food');
  const medicalPool = itemPool.filter(id=>items[id].kind==='medical');
  const gearPool = itemPool.filter(id=>items[id].kind==='gear');

  const E=(id,name,text,opts={})=>({id,name,text,...opts});
  const events = [
    E('coconut_tree','椰子树','你发现一棵挂满椰子的高树。',{type:'choice',choices:[{text:'爬树摘椰子',action:'check',stat:'agi',difficulty:'normal',success:{item:'coconut'},fail:{life:-1,chance:.2},risk:'一般'},{text:'算了',action:'none',risk:'安全'}]}),
    E('drift_box','海边漂流箱','一个被海水泡胀的箱子卡在礁石间。',{type:'check',stat:'str',difficulty:'normal',success:{randomItem:1},fail:{none:true},tags:['resource']}),
    E('wreckage','飞机残骸','扭曲的机身里也许还剩下能用的东西。',{type:'choice',choices:[{text:'钻进去翻找',action:'check',stat:'int',difficulty:'normal',success:{pickItems:3},fail:{life:-1,chance:.25},risk:'危险',tags:['mechanic','explore']},{text:'离开',action:'none',risk:'安全'}]}),
    E('redfruit','不知名红果','灌木上结着一串颜色鲜艳的红果。',{type:'choice',choices:[{text:'吃下去',action:'randomFood',risk:'危险'},{text:'不吃',action:'none',risk:'安全'}]}),
    E('stream','小溪','你找到一段清澈的小溪，终于能痛快喝水。',{type:'instant',effect:{health:1}}),
    E('cave','山洞','阴凉的山洞深处传来轻微响动。',{type:'choice',choices:[{text:'进去看看',action:'check',stat:'int',difficulty:'normal',success:{randomItem:1},fail:{beast:true},risk:'危险',tags:['explore']},{text:'不冒险',action:'none',risk:'安全'}]}),
    E('boar','野猪','树丛突然剧烈晃动，一头野猪冲了出来。',{type:'hazard',hazard:'beast',stat:'agi'}),
    E('turtle_eggs','海龟蛋','沙坑里露出几枚海龟蛋。你犹豫了一下，最后还是决定先活下去。',{type:'instant',effect:{health:1}}),
    E('storm','突然暴雨','云层压低，暴雨几乎在一瞬间倾泻下来。',{type:'hazard',hazard:'rain'}),
    E('fishing_day','浅湾里的鱼','浅湾水面不时闪过鱼鳞。',{type:'check',stat:'luck',difficulty:'normal',success:{item:'grilled_fish'},fail:{none:true},tags:['fish']}),
    E('hive','蜂巢','低矮树枝上挂着一个蜂巢。',{type:'choice',choices:[{text:'冒险取蜂蜜',action:'check',stat:'agi',difficulty:'hard',success:{health:2},fail:{health:-1},risk:'危险'},{text:'离开',action:'none',risk:'安全'}]}),
    E('footprints','奇怪脚印','泥地里出现一串不像人的脚印。',{type:'choice',choices:[{text:'跟踪',action:'check',stat:'luck',difficulty:'normal',success:{randomItem:1},fail:{beast:true},risk:'危险',tags:['explore']},{text:'离开',action:'none',risk:'安全'}]}),
    E('beach_trash','海滩垃圾','潮水退去后，沙滩留下了一堆人造垃圾。',{type:'instant',effect:{randomFrom:['bottle','tarp','rope','drybag']}}),
    E('high_coconut','高处的椰子','一只成熟椰子挂在够不着的位置。',{type:'choice',choices:[{text:'靠力量摇下来',action:'check',stat:'str',difficulty:'normal',success:{item:'coconut'},fail:{none:true},risk:'一般'},{text:'试着爬上去',action:'check',stat:'agi',difficulty:'normal',success:{item:'coconut'},fail:{health:-1,chance:.35},risk:'一般'}]}),
    E('snake','草丛里的蛇','脚边猛地窜出一条蛇。',{type:'check',stat:'agi',difficulty:'normal',success:{none:true},fail:{life:-1}}),
    E('lifeboat','废弃救生艇','半截救生艇被卡在礁石上。',{type:'check',stat:'int',difficulty:'normal',success:{pickItems:2},fail:{none:true},tags:['mechanic']}),
    E('nice_weather','美好天气','海风温和，天空难得透亮。今天的消耗似乎没那么难熬。',{type:'instant',effect:{skipDecay:true}}),
    E('spoiled_food','食物腐坏','潮湿闷热让食物坏得比想象中更快。',{type:'instant',effect:{loseFood:1}}),
    E('wave_bag','海浪卷来','突如其来的大浪冲向你放在沙滩上的背包。',{type:'check',stat:'agi',difficulty:'normal',success:{none:true},fail:{loseItem:1},tags:['water']}),
    E('suitcase','废弃行李箱','一个旅行箱被海水冲到岸边。',{type:'instant',effect:{randomItemChance:.8}}),
    E('fire_fail','生火','湿木头怎么也点不着，夜里的风越来越冷。',{type:'check',stat:'int',difficulty:'normal',success:{none:true},fail:{health:-1},tags:['fire']}),
    E('meal_box','飞机餐盒','你在残骸边找到一个还算完整的飞机餐盒。',{type:'instant',effect:{randomFood:1}}),
    E('medicine_box','漂来的药箱','一个白色药箱在浅滩里上下浮动。',{type:'instant',effect:{randomFrom:['first_aid','painkiller','disinfectant']}}),
    E('cliff_bag','悬崖上的背包','一个背包挂在陡峭岩壁的灌木上。',{type:'choice',choices:[{text:'爬过去拿',action:'check',stat:'agi',difficulty:'hard',success:{randomHighItem:1},fail:{life:-1},risk:'危险',tags:['climb']},{text:'放弃',action:'none',risk:'安全'}]}),
    E('shiny','海边发光物','沙滩上有东西反射出刺眼的光。',{type:'instant',effect:{item:'mirror'}}),
    E('night_tracks','昨夜的脚印','你顺着昨夜留下的一排脚印走进林子。',{type:'check',stat:'luck',difficulty:'normal',success:{randomFood:1},fail:{none:true}}),
    E('forgotten_bag','被遗忘的行李','灌木下压着一只旧背包。',{type:'instant',effect:{randomItem:1}}),
    E('heat','暴晒','太阳毒辣得几乎让空气扭曲。',{type:'check',stat:'luck',difficulty:'easy',success:{none:true},fail:{health:-1},tags:['water']}),
    E('lucky_day','幸运的一天','你总觉得今天运气不错。',{type:'check',stat:'luck',difficulty:'normal',success:{randomItem:1},fail:{none:true}}),
    E('nothing','平静的一天','这是登岛以后难得平静的一天。',{type:'instant',effect:{none:true}}),
    E('stranded_fish','搁浅的海鱼','退潮后，一条鱼在浅水里不断拍打尾巴。',{type:'instant',effect:{health:1}}),
    E('rotten_fruit','腐烂水果','树下有几枚已经开始腐坏的果子。',{type:'choice',choices:[{text:'切掉坏的部分吃',action:'gambleFood',risk:'危险'},{text:'扔掉',action:'none',risk:'安全'}]}),
    E('radio','废弃无线电','一台破损无线电埋在座椅残骸下。',{type:'check',stat:'int',difficulty:'hard',success:{achievement:'rescue_hope',rescueScore:1},fail:{none:true},tags:['mechanic']}),
    E('door','坠落的机舱门','一块沉重舱门下面似乎压着什么。',{type:'check',stat:'str',difficulty:'normal',success:{randomItem:1},fail:{none:true},tags:['resource']}),
    E('crevice','岩缝','狭窄岩缝里卡着一个塑料袋。',{type:'check',stat:'agi',difficulty:'normal',success:{randomItem:1},fail:{health:-1}}),
    E('rabbit','落单的野兔','一只野兔从你脚边窜过。',{type:'check',stat:'luck',difficulty:'hard',success:{health:2},fail:{none:true}}),
    E('hilltop','山顶','你终于找到一条通往岛上高地的路。',{type:'check',stat:'agi',difficulty:'normal',success:{achievement:'watch_sea',rescueScore:1},fail:{health:-1},tags:['climb','explore']}),
    E('headache','突发头痛','你一整天都昏昏沉沉，可能是脱水，也可能是压力。',{type:'instant',effect:{health:-1}}),
    E('freshwater','淡水洼','岩石凹槽里积着一汪干净的雨水。',{type:'instant',effect:{health:2}}),
    E('mushroom','奇怪蘑菇','潮湿木头上长着一片肉厚的蘑菇。',{type:'choice',choices:[{text:'吃一点',action:'mushroom',risk:'危险'},{text:'不吃',action:'none',risk:'安全'}]}),
    E('fish_trap','捕鱼陷阱','你想到可以利用石块和树枝做个简易捕鱼陷阱。',{type:'check',stat:'int',difficulty:'normal',success:{item:'grilled_fish'},fail:{none:true},tags:['fish']}),
    E('after_storm','风暴后的沙滩','昨夜风暴把许多漂浮物冲上了岸。',{type:'instant',effect:{randomItem:1}}),
    E('life_vest','救生衣','你在礁石间找到一件仍能使用的救生衣。',{type:'instant',effect:{item:'lifevest'}}),
    E('good_sleep','一夜好眠','你找到一处干燥背风的位置，久违地睡了个好觉。',{type:'instant',effect:{skipDecay:true}}),
    E('left_item','同伴留下的东西','你在营地边看到一件别人留下的物品。',{type:'instant',effect:{fromNpc:true}}),
    E('clouds','乌云压境','远处乌云越来越厚。今晚恐怕不会太平。',{type:'instant',effect:{nightDanger:.18}}),
    E('sea_dot','海上黑点','海平线上出现一个黑点。你盯了很久，最后发现那只是一截漂木。',{type:'instant',effect:{rescueScore:.25},minDay:50}),
    E('ship_shadow','远方船影','海平线尽头真的出现了一艘船。你拼命挥手，但它最终消失在暮色里。',{type:'instant',effect:{rescueScore:1},minDay:61,rescue:true}),
    E('fallen_palm','倒下的椰树','一棵被风刮倒的椰树横在林边，树冠里还挂着几只椰子。',{type:'check',stat:'str',difficulty:'easy',success:{item:'coconut'},fail:{none:true},tags:['resource']}),
    E('rain_pool','岩石水坑','昨夜的雨在岩石凹槽里积成了一小汪清水。',{type:'instant',effect:{health:1}}),
    E('seabird_nest','海鸟巢','峭壁低处有一窝海鸟蛋，伸手似乎能够得到。',{type:'choice',choices:[{text:'冒险去拿',action:'check',stat:'agi',difficulty:'hard',success:{randomFood:1},fail:{health:-1},risk:'危险',tags:['climb']},{text:'算了',action:'none',risk:'安全'}]}),
    E('tangled_net','缠住的渔网','礁石间卡着一团旧渔网，里面也许还有能用的线。',{type:'check',stat:'int',difficulty:'normal',success:{item:'fishing'},fail:{none:true},tags:['resource']}),
    E('seat_pocket','座椅夹层','一截飞机座椅被冲上岸，夹层里似乎塞着东西。',{type:'instant',effect:{randomItemChance:.72}}),
    E('thorn_path','荆棘小路','密林里有一条被荆棘遮住的小路，深处隐约能看到金属反光。',{type:'choice',choices:[{text:'钻进去看看',action:'check',stat:'agi',difficulty:'normal',success:{randomHighItem:1},fail:{health:-1},risk:'一般',tags:['explore']},{text:'绕开',action:'none',risk:'安全'}]}),
    E('dry_cave','干燥岩棚','你找到一处背风又干燥的岩棚，今天可以少消耗一点体力。',{type:'instant',effect:{skipDecay:true}}),
    E('shellfish','礁石贝类','退潮后的礁石上粘着不少贝类，但你不确定是否都能吃。',{type:'choice',choices:[{text:'挑一些吃',action:'check',stat:'luck',difficulty:'normal',success:{health:2},fail:{health:-1},risk:'一般'},{text:'不吃',action:'none',risk:'安全'}]}),
    E('rusted_case','生锈工具箱','飞机残骸旁压着一个生锈的工具箱，锁已经变形。',{type:'check',stat:'int',difficulty:'normal',success:{pickItems:2},fail:{none:true},tags:['mechanic']}),
    E('fresh_vines','含水藤蔓','你发现几根被折断后会渗出清水的藤蔓。',{type:'check',stat:'int',difficulty:'easy',success:{health:1},fail:{none:true},tags:['water']}),
    E('sudden_fog','突起浓雾','海雾突然漫进树林，熟悉的方向一下变得模糊。',{type:'check',stat:'int',difficulty:'normal',success:{none:true},fail:{health:-1},tags:['explore']}),
    E('wild_banana','野香蕉','林缘长着一小片野香蕉，果实不大，但看起来已经成熟。',{type:'instant',effect:{randomFood:1}}),
    E('rock_pool','潮池里的鱼','退潮留下的潮池里困着几条小鱼。',{type:'check',stat:'agi',difficulty:'normal',success:{item:'grilled_fish'},fail:{none:true},tags:['fish']}),
    E('horizon_smoke','海平线的烟','远处海面上升起一缕细烟。你无法判断是船，还是天气造成的错觉。',{type:'instant',effect:{rescueScore:.5},minDay:45}),
    E('aircraft_glint','云层里的反光','高空突然闪过一道规则的金属反光。你冲到开阔地挥舞能找到的一切。',{type:'instant',effect:{rescueScore:.75},minDay:65,rescue:true})
  ];


  const locations = [
    {id:'crash_beach',name:'失事海滩',x:16,y:58,icon:'🛬',desc:'飞机碎片与行李散落最多的海滩。'},
    {id:'coconut_grove',name:'椰林',x:28,y:31,icon:'🌴',desc:'树荫最浓的椰子林。'},
    {id:'fresh_stream',name:'淡水溪',x:43,y:43,icon:'💧',desc:'岛上最稳定的淡水来源之一。'},
    {id:'moon_bay',name:'月牙湾',x:67,y:65,icon:'🏖️',desc:'沙质柔软的月牙形海湾。'},
    {id:'reef_pools',name:'潮汐礁池',x:82,y:46,icon:'🪸',desc:'退潮后会留下许多潮池。'},
    {id:'jungle_path',name:'密林小径',x:24,y:72,icon:'🌿',desc:'通往林子深处的一条小路。'},
    {id:'bamboo_clearing',name:'林中空地',x:51,y:58,icon:'🍃',desc:'适合短暂停留和搭简易营地。'},
    {id:'rock_cave',name:'岩洞',x:61,y:33,icon:'🕳️',desc:'阴凉潮湿的天然洞穴。'},
    {id:'cliff_edge',name:'断崖',x:76,y:22,icon:'🪢',desc:'面朝大海的高陡崖壁。'},
    {id:'swamp_edge',name:'沼泽边缘',x:39,y:77,icon:'🪷',desc:'湿气很重，地面松软。'},
    {id:'wreck_cabin',name:'机舱残骸',x:54,y:18,icon:'✈️',desc:'损毁最严重的机体区域。'},
    {id:'ridge_hill',name:'山脊高地',x:51,y:8,icon:'⛰️',desc:'能俯瞰全岛与海平线的高点。'}
  ];

  const LE=(id,location,name,text,choices,opts={})=>({id,location,name,text,type:'choice',choices,...opts});
  const locationEvents = [
    LE('cb_supply','crash_beach','散落的餐车箱','几只翻倒的餐车箱半埋在沙里，里面也许还有能吃的东西。',[
      {text:'撬开保温箱',action:'check',stat:'str',difficulty:'normal',success:{randomFood:1},fail:{health:-1},risk:'一般',tags:['resource']},
      {text:'翻找座椅口袋',action:'check',stat:'int',difficulty:'easy',success:{randomItemChance:.75},fail:{none:true},risk:'安全'},
      {text:'坐下整理背包',action:'effect',effect:{skipDecay:true},risk:'安全'}
    ]),
    LE('cb_tide','crash_beach','回潮的行李带','一截行李带被回潮卷上岸，几个箱包卡在上面来回晃动。',[
      {text:'赶在潮水前拖上来',action:'check',stat:'agi',difficulty:'normal',success:{randomItem:1},fail:{life:-1,chance:.35},risk:'危险',tags:['water']},
      {text:'只捡最近的小包',action:'check',stat:'luck',difficulty:'easy',success:{randomItemChance:.8},fail:{none:true},risk:'安全'},
      {text:'观察潮水走势',action:'effect',effect:{nextCheckBonus:.08},risk:'安全'}
    ]),

    LE('cg_coconut','coconut_grove','成熟椰树','几棵椰树上挂着沉甸甸的果实，风一吹就轻轻摇晃。',[
      {text:'爬树摘椰子',action:'check',stat:'agi',difficulty:'normal',success:{item:'coconut'},fail:{health:-1,chance:.35},risk:'一般'},
      {text:'用木棍敲落',action:'check',stat:'str',difficulty:'normal',success:{item:'coconut'},fail:{none:true},risk:'一般',tags:['resource']},
      {text:'捡些椰叶回去',action:'effect',effect:{skipDecay:true},risk:'安全'}
    ]),
    LE('cg_birds','coconut_grove','海鸟闹林','海鸟在树冠间叫个不停，像是在围着什么东西打转。',[
      {text:'钻进去看看',action:'check',stat:'luck',difficulty:'normal',success:{randomFood:1},fail:{health:-1},risk:'一般',tags:['explore']},
      {text:'耐心等它们飞走',action:'effect',effect:{health:1},risk:'安全'},
      {text:'绕去树后搜寻',action:'check',stat:'int',difficulty:'easy',success:{randomItemChance:.7},fail:{none:true},risk:'安全'}
    ]),

    LE('fs_slippery','fresh_stream','湿滑溪石','溪边石头长满青苔，水里似乎还困着一点小鱼。',[
      {text:'踩着石头抓鱼',action:'check',stat:'agi',difficulty:'normal',success:{item:'grilled_fish'},fail:{health:-1},risk:'一般',tags:['fish']},
      {text:'先喝足淡水',action:'effect',effect:{health:1},risk:'安全'},
      {text:'沿着水流往上走',action:'check',stat:'int',difficulty:'normal',success:{randomItemChance:.75},fail:{none:true},risk:'一般',tags:['explore','water']}
    ]),
    LE('fs_herbs','fresh_stream','溪边草药','溪边长着几株带苦味的叶子，像是有药用价值。',[
      {text:'采回去试试',action:'check',stat:'int',difficulty:'normal',success:{randomFrom:['disinfectant','painkiller']},fail:{health:-1},risk:'一般'},
      {text:'只装一些水',action:'effect',effect:{health:1,skipDecay:true},risk:'安全'},
      {text:'原地休息片刻',action:'effect',effect:{skipDecay:true},risk:'安全'}
    ]),

    LE('mb_crate','moon_bay','漂流木箱','月牙湾的浅滩里卡着一个木箱，边角已经被海水泡白。',[
      {text:'直接撬开',action:'check',stat:'str',difficulty:'normal',success:{randomItem:1},fail:{health:-1},risk:'一般',tags:['resource']},
      {text:'先观察箱体破损处',action:'check',stat:'int',difficulty:'easy',success:{pickItems:2},fail:{none:true},risk:'安全'},
      {text:'坐在沙滩晒干衣服',action:'effect',effect:{skipDecay:true},risk:'安全'}
    ]),
    LE('mb_turtle','moon_bay','沙地凹痕','平整沙地上有新鲜凹痕，像是海龟刚离开不久。',[
      {text:'顺着痕迹挖一挖',action:'check',stat:'luck',difficulty:'normal',success:{health:1,randomFood:1},fail:{none:true},risk:'一般'},
      {text:'留意是否有贝类',action:'check',stat:'agi',difficulty:'easy',success:{health:1},fail:{none:true},risk:'安全'},
      {text:'安静观海',action:'effect',effect:{rescueScore:.25},risk:'安全'}
    ]),

    LE('rp_tidefish','reef_pools','退潮潮池','退潮后的礁池里困着几条小鱼和几只螃蟹。',[
      {text:'徒手抓鱼',action:'check',stat:'agi',difficulty:'normal',success:{item:'grilled_fish'},fail:{none:true},risk:'一般',tags:['fish']},
      {text:'用容器捞一捞',action:'check',stat:'int',difficulty:'easy',success:{randomFood:1},fail:{none:true},risk:'安全'},
      {text:'只挑安全的贝类',action:'effect',effect:{health:1},risk:'安全'}
    ]),
    LE('rp_shells','reef_pools','尖刺海胆','礁石缝里长满海胆和贝壳，颜色鲜艳得有些危险。',[
      {text:'冒险撬开海胆',action:'check',stat:'luck',difficulty:'hard',success:{health:2},fail:{health:-1},risk:'危险'},
      {text:'挑些贝壳带回去',action:'check',stat:'agi',difficulty:'easy',success:{randomItemChance:.7},fail:{none:true},risk:'安全'},
      {text:'绕着边缘慢慢查看',action:'effect',effect:{nextCheckBonus:.08},risk:'安全'}
    ]),

    LE('jp_thorns','jungle_path','荆棘小道','小道两边荆棘缠成一片，深处隐约有金属反光。',[
      {text:'硬着头皮钻进去',action:'check',stat:'agi',difficulty:'normal',success:{randomHighItem:1},fail:{health:-1},risk:'一般',tags:['explore']},
      {text:'绕开荆棘寻找别路',action:'check',stat:'int',difficulty:'easy',success:{randomItemChance:.75},fail:{none:true},risk:'安全'},
      {text:'砍些枝条做标记',action:'effect',effect:{nextCheckBonus:.08},risk:'安全'}
    ]),
    LE('jp_bananas','jungle_path','野香蕉丛','林缘长着一小片野香蕉，果实不大，但看起来已经成熟。',[
      {text:'直接采一把',action:'effect',effect:{randomFood:1},risk:'安全'},
      {text:'顺便深入搜索',action:'check',stat:'luck',difficulty:'normal',success:{randomItem:1},fail:{beast:true},risk:'危险',tags:['explore']},
      {text:'带着叶片返回',action:'effect',effect:{skipDecay:true},risk:'安全'}
    ]),

    LE('bc_clear','bamboo_clearing','风吹空地','林中空地通风干燥，看起来很适合休整。',[
      {text:'原地休息整理',action:'effect',effect:{skipDecay:true,health:1},risk:'安全'},
      {text:'搜寻别人留下的痕迹',action:'check',stat:'int',difficulty:'normal',success:{fromNpc:true},fail:{none:true},risk:'一般'},
      {text:'砍几根细竹带走',action:'check',stat:'str',difficulty:'easy',success:{randomFrom:['spear','torch']},fail:{none:true},risk:'安全',tags:['resource']}
    ]),
    LE('bc_insects','bamboo_clearing','低洼积水','空地一角积着浅水，周围有密集的昆虫盘旋。',[
      {text:'翻翻积水边缘',action:'check',stat:'luck',difficulty:'normal',success:{randomItemChance:.75},fail:{health:-1},risk:'一般'},
      {text:'避开虫群原路返回',action:'effect',effect:{none:true},risk:'安全'},
      {text:'取一些清亮积水',action:'effect',effect:{health:1},risk:'安全'}
    ]),

    LE('rc_bats','rock_cave','洞顶蝙蝠','岩洞顶传来扑簌簌的声音，里面也许藏着别人没发现的东西。',[
      {text:'举着火源进去',action:'check',stat:'int',difficulty:'normal',success:{randomItem:1},fail:{beast:true},risk:'危险',tags:['explore','fire']},
      {text:'只在洞口翻找',action:'check',stat:'luck',difficulty:'easy',success:{randomItemChance:.72},fail:{none:true},risk:'安全'},
      {text:'记下洞口位置',action:'effect',effect:{nextCheckBonus:.1},risk:'安全'}
    ]),
    LE('rc_cool','rock_cave','阴凉岩棚','洞边有一块干燥平整的岩棚，能遮风，也能避太阳。',[
      {text:'在这里休息',action:'effect',effect:{skipDecay:true,health:1},risk:'安全'},
      {text:'检查岩缝里的东西',action:'check',stat:'agi',difficulty:'normal',success:{randomItem:1},fail:{health:-1},risk:'一般'},
      {text:'留意地上的足迹',action:'check',stat:'int',difficulty:'easy',success:{fromNpc:true},fail:{none:true},risk:'安全'}
    ]),

    LE('ce_pack','cliff_edge','悬崖背包','一个背包挂在断崖下方的灌木上，距离不远，但下面就是海。',[
      {text:'慢慢爬下去拿',action:'check',stat:'agi',difficulty:'hard',success:{randomHighItem:1},fail:{life:-1},risk:'危险',tags:['climb']},
      {text:'利用绳索尝试勾取',action:'check',stat:'int',difficulty:'normal',success:{randomItem:1},fail:{none:true},risk:'一般',tags:['climb']},
      {text:'登高观察海面',action:'effect',effect:{rescueScore:.5},risk:'安全'}
    ]),
    LE('ce_nest','cliff_edge','海鸟巢','断崖低处有一窝海鸟蛋，风很大，但似乎并不难够到。',[
      {text:'冒险取蛋',action:'check',stat:'agi',difficulty:'hard',success:{randomFood:1,health:1},fail:{health:-1},risk:'危险',tags:['climb']},
      {text:'等海鸟飞开再动手',action:'check',stat:'luck',difficulty:'normal',success:{randomFood:1},fail:{none:true},risk:'一般'},
      {text:'只看看远方',action:'effect',effect:{rescueScore:.25,nextCheckBonus:.05},risk:'安全'}
    ]),

    LE('se_reeds','swamp_edge','药味芦苇','沼泽边长着一片带有苦味的芦苇和草叶。',[
      {text:'采一点带回去',action:'check',stat:'int',difficulty:'normal',success:{randomFrom:['disinfectant','painkiller']},fail:{health:-1},risk:'一般'},
      {text:'绕边查看漂浮物',action:'check',stat:'agi',difficulty:'normal',success:{randomItemChance:.75},fail:{health:-1},risk:'一般'},
      {text:'不深入，立刻返回',action:'effect',effect:{none:true},risk:'安全'}
    ]),
    LE('se_sink','swamp_edge','松软泥地','脚下泥地不断下陷，前方却有一小片亮闪闪的东西。',[
      {text:'快步冲过去拿',action:'check',stat:'str',difficulty:'hard',success:{randomHighItem:1},fail:{health:-1,loseItem:1},risk:'危险'},
      {text:'找树枝试探前进',action:'check',stat:'int',difficulty:'normal',success:{randomItem:1},fail:{none:true},risk:'一般'},
      {text:'放弃这点贪心',action:'effect',effect:{skipDecay:true},risk:'安全'}
    ]),

    LE('wc_cockpit','wreck_cabin','驾驶舱残片','驾驶舱附近压着不少变形金属，缝隙里似乎还留着设备。',[
      {text:'拆开面板看看',action:'check',stat:'int',difficulty:'normal',success:{pickItems:3},fail:{life:-1,chance:.25},risk:'危险',tags:['mechanic']},
      {text:'只取外露物资',action:'check',stat:'agi',difficulty:'easy',success:{randomItem:1},fail:{none:true},risk:'安全'},
      {text:'记录可用位置',action:'effect',effect:{nextCheckBonus:.1},risk:'安全'}
    ]),
    LE('wc_medkit','wreck_cabin','应急储物格','一块内饰板后面露出一个半开的储物格。',[
      {text:'用工具撬开',action:'check',stat:'int',difficulty:'normal',success:{randomFrom:['first_aid','painkiller','disinfectant']},fail:{none:true},risk:'一般',tags:['mechanic']},
      {text:'暴力拉开',action:'check',stat:'str',difficulty:'normal',success:{randomItem:1},fail:{health:-1},risk:'一般'},
      {text:'不管它，先休息',action:'effect',effect:{skipDecay:true},risk:'安全'}
    ]),

    LE('rh_signal','ridge_hill','海风高地','站在山脊最高处，整片海域都一览无余。',[
      {text:'大幅挥舞求救信号',action:'effect',effect:{rescueScore:1},risk:'安全'},
      {text:'继续向更高处观察',action:'check',stat:'agi',difficulty:'normal',success:{rescueScore:1,achievement:'watch_sea'},fail:{health:-1},risk:'一般',tags:['climb']},
      {text:'静坐恢复体力',action:'effect',effect:{health:1,skipDecay:true},risk:'安全'}
    ]),
    LE('rh_smoke','ridge_hill','海平线上的烟','远处海平线上似乎升起一缕细烟，很像船只留下的尾迹。',[
      {text:'立刻持续观察',action:'check',stat:'luck',difficulty:'normal',success:{rescueScore:1},fail:{none:true},risk:'一般'},
      {text:'用镜面反光尝试示警',action:'check',stat:'int',difficulty:'easy',success:{rescueScore:1, item:'mirror'},fail:{rescueScore:.25},risk:'安全'},
      {text:'记住这个方向',action:'effect',effect:{rescueScore:.5,nextCheckBonus:.05},risk:'安全'}
    ],{minDay:20})
  ];

  const N=(id,name,text,effect,polarity='neutral',opts={})=>({id,name,text,effect,polarity,...opts});
  const nights = [
    N('rain','暴雨','暴雨敲打着临时营地。',{allHazard:'rain'},'bad'),
    N('beast','野兽靠近','黑暗里传来低沉的喘息声。',{randomHazard:'beast'},'bad',{scope:'location'}),
    N('cold','寒夜','夜里的气温比预想更低。',{weakHealth:-1},'bad'),
    N('meteor','流星','六个人很久没有说话，只看着星星划过天空。',{none:true},'neutral'),
    N('wave','涨潮','夜里海浪突然推进了十几米。',{randomLoseItem:1},'bad',{scope:'location'}),
    N('thunder','雷雨','雷声整夜没有停。',{randomHealthDamage:.4},'bad'),
    N('crab','螃蟹','有人在营地旁抓到几只螃蟹。',{randomHealth:1},'good',{scope:'location'}),
    N('share','分享食物','有人把仅剩的一点食物分给状态最差的人。',{lowestHealth:1},'good',{scope:'location'}),
    N('argument','争吵','营火旁的争论越来越激烈。',{relationDown:1},'neutral',{scope:'location'}),
    N('theft','失窃','夜里似乎有人动过别人的背包。',{theft:true},'bad',{scope:'location'}),
    N('campfire','营火','火光让这个夜晚没有那么漫长。',{protectWeak:true},'good',{scope:'location'}),
    N('beast_far','远处的嚎叫','野兽的声音在远处徘徊，最终慢慢消失。',{none:true},'neutral'),
    N('sea_breeze','海风','海风穿过树叶。今晚什么也没有发生。',{none:true},'neutral'),
    N('dream','梦见家人','你梦见了家里的灯。醒来时，天还没亮。',{none:true},'neutral'),
    N('plane','飞机声','高空似乎传来飞机引擎声，可云层遮住了一切。',{rescueScore:.3},'good',{minDay:50}),
    N('surge','暴风潮','风浪突然暴涨，营地一片混乱。',{allChanceHealth:.45},'bad'),
    N('foodgift','食物分享','一个状态还不错的人主动拿出食物。',{lowestHealth:1},'good',{scope:'location'}),
    N('find','意外发现','有人在黑暗中摸到一件被潮水冲来的东西。',{randomItem:1},'good',{scope:'location'}),
    N('sick','生病','有人半夜开始发冷。',{randomHealth:-1},'bad',{scope:'location'}),
    N('rest','安稳的一夜','没有风雨，没有野兽，也没有争吵。',{nextCheckBonus:.1},'good',{scope:'location'}),
    N('dew','清晨露水','天亮前，大片叶片上凝满露水。有人收集到一点可以入口的水。',{randomHealth:1},'good',{scope:'location'}),
    N('branch','断枝坠落','半夜一声脆响，粗大的树枝砸进营地边缘。',{randomHealthDamage:.25},'bad',{scope:'location'}),
    N('stars','满天星光','云层散开，星空异常清晰。这个夜晚让人重新冷静下来。',{nextCheckBonus:.05},'good'),
    N('insects','虫群','潮湿天气引来大量虫子，几乎没人睡好。',{randomHealth:-1},'bad',{scope:'location'}),
    N('moon_tide','月下退潮','月光把退潮后的礁石照得发白。海面安静得出奇。',{none:true},'neutral'),
    N('distant_light','远海灯光','很远的海面上，似乎有一盏灯一闪而过。没有人敢确定那是不是船。',{rescueScore:.5},'good',{minDay:60})
  ];

  return {characters,items,itemPool,foodPool,medicalPool,gearPool,events,locations,locationEvents,nights};
})();
