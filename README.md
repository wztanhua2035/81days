# 《八十一天》v2.7

单人荒岛卡牌冒险网页游戏，可直接部署到 Zeabur。

## v2.7 本次调整

- 修复移动途中事件在中/大字体下文字框过矮的问题：移动事件场景区域会随字体档位增高，普通长度文本不再需要频繁上下滑动。
- 提高动物互动文字与深色背景的对比度，确保说明文字清晰可读。
- 进入“探索”页面后，不再在地点图片右上角显示“同地点伙伴”头像，减少遮挡与重复信息。
- 管理后台新增“背景音乐管理”：
  - 上传 WAV / MP3 / OGG / M4A / AAC；
  - 删除自定义上传音乐；
  - 勾选哪些音乐提供给玩家；
  - 只有后台勾选的曲目才会显示在玩家“本局资料 → 背景音乐”里；
  - 上传文件保存在 `public/assets/music`，与内置四首 BGM 位于同一目录。
- 内置音乐可取消启用，但不能从后台物理删除；自定义上传音乐可删除。

## 本地运行

```bash
npm start
```

默认地址：

```text
http://localhost:3000
```

管理后台：

```text
http://localhost:3000/admin
```

默认管理密码：

```text
818181
```

首次部署后请尽快修改管理密码。

## Zeabur 部署

1. 将项目上传 GitHub。
2. 在 Zeabur 新建 Project。
3. Deploy New Service → GitHub → 选择仓库。
4. 启动命令使用 `npm start`。
5. 绑定域名即可。

游戏会自动读取 `process.env.PORT`。

### 持久化提醒

排行榜和后台参数建议继续使用 Zeabur Volume，例如：

```text
/data
```

并设置：

```text
ADMIN_DATA_DIR=/data
```

后台上传的背景音乐按本次要求直接写入：

```text
public/assets/music
```

Zeabur 重新构建容器时，运行时上传的文件可能会丢失。若希望后台上传的音乐长期保留，请额外把 Volume 挂载到项目的 `public/assets/music` 目录，或在确认曲目后把音乐文件提交回 GitHub 仓库。
