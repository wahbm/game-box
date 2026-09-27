# 项目上下文

更新：2026-09-27。本文件用于 AI 接手定位；设计细节见 [ARCHITECTURE](ARCHITECTURE.md)，后续工作见 [TODO](TODO.md)。

## 目标与当前状态

“拾趣”是可扩展的轻量游戏盒，首版面向 PC/手机浏览器，现代浅色界面、简体中文、无需登录、本地自动存档。未来以更复杂的 2D 单机游戏为主，通过统一生命周期接入不同渲染方式。

当前目录从空目录完成首版及一轮体验打磨。已初始化 Git，远端为公开仓库 [wahbm/game-box](https://github.com/wahbm/game-box)，主分支 `main`、远端名 `origin`。GitHub Pages 已上线：https://wahbm.github.io/game-box/ ，无自定义域名。发布提交 `8aba475` 已通过远端完整 CI 与公网游戏入口/刷新续玩检查。CI 检查和测试通过后自动发布 main；运行结果以远端 Actions 为准。发布使用 VITE_BASE_PATH=/game-box/，本地保持根路径。本地预览曾使用 5173，接手时需确认进程，勿假定仍运行。

## 技术与入口

React 19、TypeScript 严格模式、Vite 7、DOM/SVG、Dexie 4/IndexedDB；pnpm workspace。Vitest 3 + fake-indexeddb、Playwright、Prettier。精确依赖版本以 pnpm-lock.yaml 为准。

| 位置                                                | 职责                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/main.tsx`、`registry.ts`、`style.css` | 大厅、hash 路由、GameHost、注册表、响应式样式               |
| `packages/sdk`                                      | Manifest、Module、Context、Instance、存档契约及种子随机工具 |
| `packages/platform`                                 | 本地顺序写入、上一份备份、原档归档                          |
| `packages/ui`                                       | React 游戏挂载适配器、公共 UI、暂停与销毁                   |
| `packages/link`、`spider`、`tower`                  | 各自 manifest、纯规则、界面；魔塔另有 content.json          |
| `tests`、`.github/workflows/ci.yml`                 | 规则/存档/架构与浏览器测试、CI 配置                         |
| 根 `index.html`、配置及 package.json                | 实际构建入口和依赖；产物为 dist/                            |

## 已完成与本轮落点

- 平台：三款游戏懒加载、独立 URL、最近游玩/继续、规则、暂停、新局确认、错误提示；本地存档、备份恢复、损坏原数据归档。存档格式均为 1，没有历史版本转换实现，未知版本拒绝读取。
- 连连看：十关、最多两次折弯/外圈连接、可解生成与洗牌、提示、死局自动重排。后续修正不同图案/路径受阻提示、重复点击取消选择；加入 900ms 实际连接路径、状态图例、按真实行列间距定位、反馈清理及即时保存。
- 蜘蛛：104 张单花色、拖动/点选、补发、自动收牌、完整撤销；修复堆叠点击区域，支持牌面放大与局部滚动。
- 魔塔：原创十层配置、战损预览、钥匙门/属性道具/商店/楼梯/Boss、入口回退；基准路线可完成十层，不代表平衡和策略深度已充分打磨。
- 手机浏览器：360px、横竖屏、操作按钮最小高度、切后台暂停与显式恢复已自动化检查；物理设备未验收。

## 命令与验证基线

```sh
pnpm install --frozen-lockfile
pnpm dev                              # 默认 5173，监听局域网
pnpm typecheck
pnpm test                             # 当前 20 项
pnpm build                            # 类型检查 + dist/
pnpm check                            # 格式 + 类型 + 单元测试 + 构建
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e                         # 自动启动 4173；当前 65 项
pnpm format:check
pnpm format                           # 写文件，仅需要时使用
```

本轮 `pnpm check`、完整 65 项 E2E 通过；最后一次路径行距修正后重新构建，并重跑相关 15 项 E2E 通过。五个项目为桌面 Chromium/Firefox/WebKit、360px Chromium、iPhone WebKit 模拟。详见 [验证记录](verification.md)，这些是历史证据，不等于未来修改后仍通过。

本机曾需显式选择 `/Users/mosi/.nvm/versions/node/v22.23.2/bin`（默认 shell 为 Node 18）；Corepack 缓存使用 `/private/tmp/game-box-corepack`，浏览器下载到 `/private/tmp/game-box-browsers`。复用后者需设置 `PLAYWRIGHT_BROWSERS_PATH`；临时目录可能清理，不要写死为项目要求。`.npmrc` 将 pnpm store 放在项目内。下载依赖和启动监听端口曾需沙箱权限提升。
