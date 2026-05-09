# LifeOS - AI增强型个人生产力系统

LifeOS 是一个基于原生 JavaScript 构建的轻量级个人生产力应用，融合任务管理、历史回看、数据分析与 AI 任务拆解能力，适合作为展示级前端项目与个人作品集项目。

## 项目简介

LifeOS 提供「每日任务 + 临时任务」双任务体系，并支持多项目（Workspace / Projects）管理。用户可在同一应用中完成任务规划、执行、复盘与数据洞察，形成完整的个人效率闭环。

## 核心功能

- 多项目管理：支持创建、切换、删除项目，每个项目独立数据
- 任务系统：支持每日任务 / 临时任务的新增、完成、删除
- 本地持久化：所有任务与状态持久化在 `localStorage`
- 筛选能力：按全部 / 未完成 / 已完成查看任务
- 拖拽排序：支持 HTML5 Drag & Drop 调整任务顺序
- AI 智能拆解：输入模糊任务后自动生成子任务与优先级建议（本地规则模拟）
- 历史记录 / 日历：按日期查看历史任务快照
- Dashboard 数据面板：今日完成率、任务统计、最近 7 天趋势、连续完成天数

## 技术栈

- HTML5
- CSS3
- Vanilla JavaScript（ES6+）
- `localStorage`（前端本地数据持久化）

## 项目亮点

- **纯前端产品化实现**：无需后端即可完成完整功能链路
- **可扩展架构**：AI 拆解逻辑可平滑替换为真实 AI API
- **多项目隔离**：项目级任务、历史、统计数据独立管理
- **展示友好**：具备产品级 UI 与完整 README，适合 GitHub 展示

## 在线访问（占位）

- [life-os-iota-azure.vercel.app]

## 快速使用

1. 克隆项目
   ```bash
   git clone <your-repo-url>
   cd todo-app
   ```
2. 直接本地打开 `index.html`，或使用任意静态服务器启动
   ```bash
   npx serve .
   ```
3. 在浏览器访问本地地址即可使用

## 截图展示

> 将以下占位图替换为真实项目截图即可。

### Dashboard
![Dashboard](assets/screenshot-dashboard.png)

### Projects
![Projects](assets/screenshot-projects.png)

### AI 智能拆解
![AI Decompose](assets/screenshot-ai.png)

## 部署说明（无需改代码）

### 方案一：Vercel

1. 将仓库推送到 GitHub
2. 登录 [Vercel](https://vercel.com/)
3. 点击 **New Project** 并导入该仓库
4. Framework Preset 选择 **Other**
5. 保持默认设置，点击 **Deploy**
6. 部署完成后获得线上地址（可回填 README 的在线访问链接）

### 方案二：Netlify

1. 将仓库推送到 GitHub
2. 登录 [Netlify](https://www.netlify.com/)
3. 点击 **Add new site** -> **Import an existing project**
4. 选择 GitHub 仓库并授权
5. Build command 留空；Publish directory 设置为 `.`
6. 点击 **Deploy site**

## 目录结构

```text
todo-app/
├── index.html
├── style.css
├── script.js
├── README.md
└── assets/
    ├── screenshot-dashboard.png
    ├── screenshot-projects.png
    └── screenshot-ai.png
```

## License

MIT
