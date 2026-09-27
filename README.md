# 拾趣 · 游戏盒

面向桌面和手机的轻量单机游戏合集。React + TypeScript + Vite，使用 pnpm workspace；游戏运行代码按需加载。

AI 接手先读 [AGENTS.md](AGENTS.md) 和 [项目上下文](docs/PROJECT_CONTEXT.md)，待办见 [TODO](docs/TODO.md)。

## 本地运行

需要 Node.js 22+、pnpm 10.15.1。

```sh
corepack enable
pnpm install
pnpm dev
```

打开终端显示的地址。开发服务器监听局域网；同一网络中的手机可使用电脑局域网地址访问。首次访问需联网取得页面和资源，首版没有离线启动能力。

```sh
pnpm check          # 格式、类型、规则/存档/架构测试、生产构建
pnpm test:e2e       # 浏览器集成测试
pnpm format        # 统一格式
pnpm exec playwright install chromium firefox webkit
```

端到端测试自动启动端口 4173 的开发服务器。测试覆盖桌面 Chromium、Firefox、WebKit，以及 Chromium 360px 手机视口、iPhone WebKit 视口；移动模拟不代替真机测试。

## 玩法

- **连连看**：10 关，无倒计时；最多两次折弯，允许走外圈；提示、洗牌和死局自动重排。初始与重排局面使用几何消除序列保证可解。
- **蜘蛛纸牌**：104 张单花色纸牌；点击或拖动降序牌组，八组 K–A 收集完成后获胜。支持全部操作撤销，空列禁止补发。
- **魔塔**：原创 10 层固定地图，钥匙、门、宝石、商店、药水和守卫；方向键/WASD/触屏方向按钮移动。自动确定性战斗，邻近敌人显示战损，不可战胜时阻止行动。支持楼梯往返及回退本层入口。

本地存档只属于当前浏览器和当前网站地址，清除网站数据会删除进度。无账号、云同步、联机、广告或付费。

## 工程目录

```text
apps/web       大厅、路由、运行容器、响应式样式
packages/sdk   平台与游戏之间的纯 TypeScript 契约
packages/ui    React 挂载适配器、公共游戏 UI
packages/platform  IndexedDB/Dexie 存档实现
packages/link  连连看 manifest / rules / UI
packages/spider    蜘蛛纸牌 manifest / rules / UI
packages/tower     魔塔 manifest / rules / UI / 内容数据
```

[架构与新增游戏](docs/ARCHITECTURE.md) · [验收与发布](docs/verification.md)

## 静态托管

`pnpm build` 生成 `dist/`。将目录发布到支持静态资源的 HTTPS 主机即可；路由使用 `/#/games/link` 等 hash URL，不要求服务端配置页面重写。默认部署在域名根目录；子目录部署时需设置 Vite `base` 并重新构建。没有服务端或数据库部署步骤。

远端仓库：[wahbm/game-box](https://github.com/wahbm/game-box)（公开），主分支 `main`。已选择 GitHub Pages，目标地址为 https://wahbm.github.io/game-box/ ，未绑定自定义域名。`main` 推送或手动运行 CI 会在检查、测试通过后发布；PR 只检查不发布。发布构建设置 `VITE_BASE_PATH=/game-box/`，本地开发默认根路径。
