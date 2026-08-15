# 八十一天 DAY 81

单人卡牌荒岛生存网页小游戏。无需数据库、无需大模型 API，适合直接部署到 Zeabur。本版本加入了更多随机事件与密码管理后台。

## 已实现

- 6 名可选幸存者与不同职业技能
- 生命 / 健康 / 力量 / 敏捷 / 知识 / 幸运系统
- 30+ 道具；背包容量默认 4，可在后台改为 3—6
- **63 张机遇卡**（原 48 张，增加 15 张，约 +31%）
- **26 种夜间事件**（原 20 种，增加 6 种，+30%）
- 新增机遇卡、夜间事件直接混入原牌池随机出现
- 默认每 5 天一次人物遭遇（DAY 6 / 11 / 16 ...），后台可调整
- 战斗、躲避、交易与永久敌对关系
- 5 名 NPC 的规则型自动行动
- DAY 1 → DAY 81 完整胜负流程
- 生存日志、最终评分和趣味评价
- localStorage 自动存档，刷新后继续
- 手机竖屏优先，同时兼容桌面浏览器
- Seed 状态随机数，避免刷新重新抽取已确定事件
- 密码管理后台 `/admin`

## 管理后台

浏览器访问：

```text
https://你的域名/admin
```

默认管理密码：

```text
818181
```

**部署后请第一时间进入后台修改密码。**

也可以在第一次启动前设置环境变量：

```text
ADMIN_PASSWORD=你自己的初始密码
```

> 如果服务器已经生成过 `data/admin-config.json`，之后以后台修改后的密码为准。

后台可以修改：

- 六位角色姓名
- 夜间事件触发概率（10%—90%）
- 全局属性检定修正（-20%—+20%）
- 人物遭遇间隔（3—10天）
- 基础躲避成功率（5%—60%）
- 每日健康自然下降概率（50%—100%）
- 连续三天健康≥2后的生命恢复概率（0%—60%）
- 背包容量（3—6）
- 每人开局额外食物（0—2）
- 管理密码

角色姓名在玩家刷新页面后更新。为避免一局游戏中途突然改变规则，**难度参数在玩家新开一局时写入该局存档**。

## 后台设置保存

默认设置文件保存在项目目录：

```text
data/admin-config.json
```

普通部署即可使用，但容器重新部署时，平台可能重建文件系统。若希望后台设置在 Zeabur 重新部署后仍永久保留，建议给服务挂载一个持久化 Volume，例如 `/data`，并增加环境变量：

```text
ADMIN_DATA_DIR=/data
```

不配置 Volume 也不影响游戏本身运行。

## 本地运行

要求 Node.js 18 或更高版本。

```bash
npm install
npm start
```

浏览器访问：

```text
http://localhost:3000
```

后台：

```text
http://localhost:3000/admin
```

## 平衡模拟

```bash
npm run simulate
```

也可以指定每名角色模拟局数：

```bash
node simulation.js 2000
```

模拟器是快速近似模型，用来发现明显的角色强弱差；它不完全等价于真人操作下的最终胜率。

## Zeabur 部署

### GitHub 方式

1. 解压项目，把 `day81` 文件夹中的全部文件上传到一个 GitHub Repository。
2. 在 Zeabur 创建 Project。
3. 新建 Service，选择 GitHub Repository。
4. Zeabur 识别 Node.js 项目并启动。
5. 启动命令为 `npm start`。
6. `server.js` 自动读取 `process.env.PORT`。
7. 添加域名后访问游戏首页。
8. 访问 `/admin`，使用默认密码 `818181` 登录并立即修改密码。

项目同时提供 `Dockerfile` 作为备用部署方式。

## 目录

```text
day81/
├── package.json
├── package-lock.json
├── server.js
├── simulation.js
├── Dockerfile
├── README.md
├── data/
│   └── （首次运行后生成 admin-config.json）
└── public/
    ├── index.html
    ├── style.css
    ├── data.js
    ├── npc.js
    ├── game.js
    ├── manifest.json
    ├── admin.html
    ├── admin.css
    └── admin.js
```

## 游戏存档

玩家游戏进度保存在各自浏览器 localStorage 中，因此更换设备或清空浏览器数据不会自动同步。管理后台设置则保存在服务器端 JSON 文件中，两者互不影响。
