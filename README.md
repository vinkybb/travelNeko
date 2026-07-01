# TravelNeko

TravelNeko 是一个带有多 Agent 叙事能力的旅行猫咪小游戏原型。

它不是传统的“聊天工具壳”，而是一个更接近小镇 RPG / 星露谷式入口体验的网页游戏：

- 先进入一个氛围化的开始界面
- 再进入可探索的地图世界
- 主角猫可以手动移动，也可以点击让 AI 自动探索
- 与某只猫一对一多轮聊天，聊着聊着可能触发一段预设剧情
- 觉得这段相遇值得纪念，就把它写进旅行手账
- 之后可以随时回看这段对话，以及猫咪们的幕后花絮

## Why This Project

TravelNeko 想验证一件事：

能不能把 LLM 多 Agent 协作，从“后台编排”变成“玩家可感知的游戏体验”。

在这个项目里，多 Agent 不只是隐藏在 API 后面做文本拼接，而是明确承担不同游戏角色：

- `Scout Cat` 负责布置遭遇、天气、氛围和场景挑战
- `Companion Cat` 负责旁边猫咪的插话与花絮
- `Oracle Cat` 负责把暗线、伏笔和隐藏线索压进剧情
- `Archivist Cat` 负责把相遇整理成一篇完整的旅行手账
- `Painter Cat` 可选生成明信片图片
- `Plot Director` 每轮判断当前这句话是否该触发某段预设剧情
- `Chat Reply Cat` 在多轮聊天里以目标猫的口吻实时回应玩家

## Screenshot Gallery

### 1. Start Screen

项目首先进入一个类似星露谷物语风格的开始页，而不是直接落到表单工具界面。

![TravelNeko start screen](./docs/screenshots/homepage-start-screen.png)

### 2. World Exploration

进入游戏后就是 RPG 风格地图。玩家可以用键盘移动，也可以点击区域或猫咪自动寻路。

![TravelNeko world exploration](./docs/screenshots/world-exploration-screen.png)

### 3. NPC Dialogue

与目标猫是一对一的多轮聊天，目标猫会持续回应你；聊到对味时会亮起“把这段相遇写进手账”的提示。

![TravelNeko NPC dialogue](./docs/screenshots/npc-dialogue-screen.png)

### 4. AI Auto Explore Kiosk

点「让 AI 自动探索」后，动作区会实时显示多 Agent 的处理进度。

![TravelNeko AI auto explore kiosk](./docs/screenshots/ai-auto-explore-kiosk-screen.png)

### 5. Archive / Journal View

把一段相遇写进手账后，故事摘要、明信片配图、正文、对话与各 Agent 注释都会归档。

![TravelNeko archive journal](./docs/screenshots/archive-journal-screen.png)

## Core Gameplay Loop

### 1. Enter The World

玩家从开始界面进入旅行小镇。

当前地图区域包括：

- 雾灯港
- 彩旗集市
- 风车坡
- 月影旧街
- 纸灯书屋

### 2. Move The Cat

主角猫支持两种探索方式：

- 手动移动：`WASD` / 方向键
- 自动移动：点击地图空地、区域按钮或 NPC

### 3. Talk / Trigger An Encounter

玩家可以：

- 在 `Live Chat` 面板与目标猫多轮聊天；聊到贴合某段预设剧情时，剧情导演会触发它
- 聊完点「把这段相遇写进手账」，让多 Agent 流水线把这段对话整理成一章故事
- 点击 `AI 自动探索`，让系统自主决定下一站和相遇对象，并直接生成一段相遇

### 4. Multi-Agent Conversation

有两条会用到多 Agent 的路径：

**A. 多轮聊天（Live Chat）** —— 每发一句：

1. `Plot Director` 判断这一刻是否触发/推进某段预设剧情
2. `Chat Reply Cat` 以目标猫的口吻实时回应（触发剧情时按剧情走向发挥）

**B. 写进手账 / AI 自动探索** —— 跑完整流水线，把相遇沉淀成一章故事：

1. `Pathfinding`
2. `Info Kiosk`
3. `Scout Cat`
4. `Companion Cat`
5. `Oracle Cat`
6. `Archivist Cat`（触发了剧情时会以该剧情为锚）

流水线阶段不是隐藏黑箱，而是通过右侧信息台持续反馈给玩家。

### 5. Persist The Story

每次相遇都会被保存到本地旅行档案中，包括：

- 玩家输入
- 地图区域与目标猫
- 场景信息
- 对话记录
- 隐藏线索
- 故事摘要
- 手账正文
- 纪念物
- Agent 注释卡片
- 触发的剧情（如有）
- 明信片图片（启用图片生成时）

此外，flag / 完成剧情 / 到访次数 / 关系值会单独持久化到 `data/game-state.json`，实现跨会话记忆与链式剧情。

## Current Feature Set

### Gameplay

- 开始界面 + 世界地图双阶段体验
- RPG 风格地图探索页面
- SVG 猫咪角色和区域化地图
- 手动移动与自动寻路
- AI 自动探索模式
- 多轮 Live Chat 聊天，聊天中可触发预设剧情
- 聊完手动「把这段相遇写进手账」（AI 自动探索仍自动归档）
- 实时信息台展示多 Agent 处理过程

### Narrative / Agent System

- 多 Agent 协同故事生成
- 目标猫优先发言
- 邻近猫咪偶尔插话
- 故事中包含场景推进、互动、暗线、总结、纪念物
- 预设剧情库 + 剧情导演：规则预筛 + LLM 判定，支持链式剧情
- 关系值 / flag / 完成剧情的持久化（跨会话记忆）
- 明信片真实图片生成（可选开启）

### Model Integration

- OpenAI 兼容接口接入（默认指向 OpenAI 官方 API，可通过环境变量改为任意兼容端点）
- 支持配置文本模型、视觉模型和图片模型
- 地图页「信息台」可选上传旅行照片（data URL 发往 `/api/journey` 的 `imageDataUrl`），由视觉模型提取氛围与线索
- 功能开关：`ENABLE_IMAGE_GENERATION`（明信片出图）、`ENABLE_PLOT_DIRECTOR`（剧情导演；关掉则退回按优先级的确定性规则触发）

### Persistence

- 旅行手账保存在 `data/journals.json`
- 游戏状态（flag / 完成剧情 / 到访次数 / 关系值）保存在 `data/game-state.json`
- 多轮聊天会话保存在 `data/chat-sessions.json`
- 首页和地图页会自动读取已有档案

### Testing

- 本地单测：Agent 编排与存储逻辑
- 真实 LLM smoke test：验证接口联通和端到端生成

## Tech Stack

- `Next.js 15`
- `React 19`
- `TypeScript`
- `OpenAI Node SDK`
- `Vitest`
- 本地 JSON 存储

## Project Structure

```text
app/                      Next.js app router 页面与 API
components/               前端交互组件
lib/                      配置、多 Agent 编排、剧情解析、模型接入、存储等
content/plots/            预设剧情定义
data/journals.json        本地故事档案
data/game-state.json      游戏状态
data/chat-sessions.json   多轮聊天会话
docs/screenshots/         README 截图素材
docs/plans/               设计文档
scripts/smoke-journey.ts  真实接口 smoke test
tests/                    单元测试
```

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

复制环境变量模板到 `.env.local`（已被 git 忽略，Next.js 会在启动时自动加载），然后填入你的 key：

```bash
cp .env.example .env.local
# 然后编辑 .env.local，至少把 LLM_API_KEY 换成真实值
```

`.env.example` 里列出了全部可配置项（**一套中性命名**；对接 OpenAI 官方或千帆等兼容服务只需改 `DEFAULT_BASE_URL` 与模型名）。最关键的一项：

```bash
LLM_API_KEY=YOUR_KEY   # 必填，缺失会导致 /api/* 返回 500
```

> 改动 `.env.local` 后需重启 dev server（Next.js 只在启动时读取环境变量）。

### 3. Run In Dev Mode

```bash
npm run dev
```

默认访问：

```bash
http://localhost:3000
```

### 4. Run In Preview Mode

如果你希望使用更稳定的本地预览：

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

## Available Scripts

### Start Development Server

```bash
npm run dev
```

### Build Production Output

```bash
npm run build
```

### Start Production Preview

```bash
npm run start -- --hostname 127.0.0.1 --port 3000
```

### Run Unit Tests

```bash
npm test
```

### Run Live LLM Smoke Test

```bash
npm run test:smoke
```

## LLM Smoke Test

项目内置了一个真实模型 smoke test，用来验证：

- `LLM_API_KEY` 是否有效
- OpenAI 兼容 base URL 是否可用
- 文本模型是否能完成一轮完整多 Agent 旅程生成

运行：

```bash
npm run test:smoke
```

## Notes About Running Locally

如果你本地遇到类似下面的问题：

- `Cannot find module './331.js'`
- 浏览器请求旧的 `/_next/static/chunks/app/page-xxxx.js`
- 页面报 client-side exception

通常是 `.next` 产物或浏览器缓存和当前运行实例不一致。

最稳的恢复方式：

```bash
rm -rf .next
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

并且尽量不要在同一个项目目录里混着跑：

- `npm run dev`
- `npm run build`
- `npm run start`

尤其不要在 `dev` 正运行时再做一次 `build`。

## What Makes This Different

很多 AI 游戏 Demo 的问题是：

- 看起来像表单
- 多 Agent 只是隐藏的 prompt 链
- 玩家感受不到“世界”
- 结果像一次性生成，而不是一次相遇

TravelNeko 这版更关注“可感知性”：

- 玩家先进入一个世界，而不是一段输入框
- 地图、角色、移动和区域是可见的
- 多 Agent 流程通过信息台可视化
- 旁边的猫咪也会在手账的幕后花絮里出现，让相遇更有现场感
- 每次结果都会沉淀成手账，而不是只停留在聊天记录里

## Roadmap

接下来适合继续推进的方向：

- 更明显的 tile / pixel-art 地图风格
- 障碍、碰撞、区域触发器
- 靠近 NPC 才能触发对话
- 实时头顶对话气泡，而不只是事后手账展示
- 更完整的 AI 自动漫游逻辑
- 更丰富的剧情库与多环链式剧情
- 明信片图片本地持久化
- 多地图切换与旅行路线系统

## Status

这是一个已经可运行、可测试、可演示的原型，但仍处于 MVP 阶段。

它已经具备：

- 清晰的世界入口
- 核心探索闭环
- 多 Agent 叙事链路
- 本地可复现的页面效果
- 可写入 README 的完整截图素材
