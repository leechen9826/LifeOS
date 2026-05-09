# LifeOS Mobile · 使用说明

## 📁 文件结构

```
LifeOS-mobile/
  ├── index.html      移动端首页
  ├── mobile.css      手机优化样式
  ├── mobile.js       全部交互逻辑
  ├── manifest.json   PWA 配置（让它能加到主屏幕）
  ├── sw.js           离线缓存
  └── README.md       本文件
```

把这些文件**放在你网页端项目的同一个目录下**（和 `index.html`、`style.css`、`script.js` 同级），就能和网页端共享同一份数据。

## 🚀 快速开始（在电脑上预览）

1. 把整个 `LifeOS-mobile` 文件夹放到你网页端项目里，比如：
   ```
   你的项目/
     ├── index.html         (网页端，不动)
     ├── style.css          (不动)
     ├── script.js          (不动)
     └── LifeOS-mobile/     (新加的)
         ├── index.html
         ├── mobile.css
         ├── mobile.js
         ├── manifest.json
         └── sw.js
   ```

2. 在 VS Code 里用 Live Server 启动，浏览器访问：
   ```
   http://127.0.0.1:5500/LifeOS-mobile/
   ```

3. **在浏览器里测试移动端效果**：
   - Chrome 按 F12 打开开发者工具
   - 点左上角的"切换设备工具栏"图标（或 Ctrl+Shift+M / Cmd+Shift+M）
   - 顶部选个机型，比如 iPhone 14 Pro
   - 刷新页面，就能看到移动端效果了

## 📱 在手机上打开（同一个 WiFi 下）

1. 电脑上 Live Server 启动后，找到电脑的局域网 IP：
   - **Windows**：CMD 里 `ipconfig`，找 "IPv4 地址"
   - **Mac**：终端 `ipconfig getifaddr en0`
   - 假设是 `192.168.1.10`

2. 手机连同一个 WiFi，浏览器访问：
   ```
   http://192.168.1.10:5500/LifeOS-mobile/
   ```

3. 如果打不开，可能是 VS Code Live Server 默认只监听本机。
   解决办法：VS Code 设置里搜 `liveServer.settings.host`，改成 `0.0.0.0`，重启 Live Server。

## ⭐ 加到主屏幕（变成 app 图标）

**iPhone (Safari)：**
1. 打开页面
2. 底部分享按钮（向上箭头）
3. "添加到主屏幕"
4. 主屏幕会出现 LifeOS 图标，点击全屏运行（无地址栏）

**Android (Chrome)：**
1. 打开页面
2. 右上角菜单
3. "安装应用" 或 "添加到主屏幕"

加到主屏幕之后，看起来就跟原生 app 一样，没有浏览器地址栏，全屏运行，离线也能打开。

## 🔄 数据同步

移动端和网页端**共享同一份 localStorage 数据**——
- 你在网页端添加的任务，移动端打开也能看到
- 反之亦然
- 因为 localStorage 是按域名隔离的，所以**必须在同一个域名下访问**才能同步

⚠️ **注意**：localStorage 不会跨设备同步。手机和电脑是两份独立数据。要跨设备同步需要后端服务器，这个 demo 暂未实现。

## 🎨 已实现的功能

- ✅ 添加 / 完成 / 删除任务（左滑删除有动画）
- ✅ 每日任务 / 临时任务 切换
- ✅ 全部 / 未完成 / 已完成 过滤
- ✅ 智能拆解（与网页端规则一致）
- ✅ 项目管理（新建、切换、删除）
- ✅ 数据面板（完成率、连续天数、7 天柱状图）
- ✅ 历史记录（按日期查看）
- ✅ 安全区适配（刘海屏、灵动岛）
- ✅ PWA（可加到主屏幕、离线可用）
- ✅ 触觉反馈（完成任务时震动）
- ✅ 跨页面数据自动同步

## 🛠 想改的话

- **颜色 / 圆角 / 间距**：改 `mobile.css` 顶部 `:root` 里的 CSS 变量
- **底部 Tab 顺序 / 名字**：改 `index.html` 里 `.m-tabbar` 部分
- **智能拆解规则**：改 `mobile.js` 里的 `getAiSubtasks` 函数（和网页端 `getAiSubtasksByRules` 保持一致即可）

## ❓ 常见问题

**Q: 手机访问报错 / 白屏**
A: 检查是不是 https 才支持的功能。本地测试用 http 没问题，但部署到公网时 PWA 必须用 https（用 Vercel / Netlify / Cloudflare Pages 部署最简单，免费）。

**Q: Service Worker 注册失败**
A: 必须通过 http(s) 协议访问，不能用 `file://` 直接打开 html。一定要用 Live Server 或类似的本地服务器。

**Q: 加到主屏幕没出现"安装应用"选项？**
A: 需要满足：① 通过 https（或 localhost）访问 ② manifest.json 加载成功 ③ 注册了 service worker。本地测试 localhost 都满足。
