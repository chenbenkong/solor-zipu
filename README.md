# 3D 太阳系 · 星隼号 ZF-77 飞船版（solor-zipu）

在原有 3D 太阳系网页的基础上，新增一艘星球大战风格的原创星际飞船 **星隼号 ZF-77**：
支持**自动驾驶导航到任意天体**（随行星转动持续追踪最佳观赏点）、**自由驾驶**、
**舱内第一视角（巨型透明舷窗 + 可收起全息控制台）**与**舱外第三视角**一键切换。

> 本仓库为独立新仓库，原仓库 [chenbenkong/sy-826](https://github.com/chenbenkong/sy-826) 保持零改动。

**在线预览**：<https://chenbenkong.github.io/solor-zipu/>

---

## 快速上手

### 在线体验

打开 <https://chenbenkong.github.io/solor-zipu/>，点击右侧 **「登上飞船」** 按钮即可进入飞船模式。

### 本地运行

```bash
npm install     # 安装依赖（React 18 + Three.js + Vite 5）
npm run dev     # 启动开发服务器，自动打开 http://localhost:3000
npm run build   # 生产构建，输出到 dist/
npm run preview # 本地预览生产构建
```

---

## 操作指南

### 太阳系模式（原有功能）

- 鼠标拖拽旋转视角，滚轮缩放，点击星球查看信息并聚焦
- 右上「导航」面板：选择天体直接跳转（飞船模式下同样可用，会触发飞船自动驾驶）
- 底部控制栏：暂停 / 时间流速 / 轨道线 / 星空 / 名称 / Bloom / 光晕 / 全局缩放 / 黑洞体验
- `Space` 暂停，`↑/↓` 调时间流速，`◎` 影院模式，`Esc` 退出

### 飞船模式（星隼号 ZF-77）

点击「登上飞船」进入。三种飞行模式：

**1. 景观悬停**（默认）——飞船悬浮原地，相机缓慢环绕，可完整欣赏飞船本体。

**2. 自由驾驶**

| 按键 | 功能 |
|------|------|
| `W` / `S` | 加速 / 减速倒退 |
| `A` / `D` 或 `←/→` | 偏航转向 |
| `↑` / `↓` | 俯仰（抬头 / 低头） |
| `Q` / `E` | 滚转 |
| `Shift` | 加力推进 |
| `V` | 切换舱内 / 舱外视角 |
| `C` | 收起 / 展开控制台 |
| `Esc` | 退出飞船模式（相机恢复原位） |

**3. 自动驾驶**

- 打开底部控制台 →「自动导航」→ 选择任意星球 / 太阳 / 卫星 / 小行星
- 飞船自动脉冲跳跃 → 接近减速 → 锁定**最佳观赏点**（背阳侧偏外、阳光照亮面）
- 锁定后随行星**自转与公转持续追踪**（锚点前馈零滞后），始终保持在向阳面最佳观赏角度
- 最佳观赏参数自动保存（localStorage），下次导航同一目标直接复用；跨页面刷新依然生效
- 导航中可随时点「解除自动驾驶」或切换自由驾驶手动接管

### 双视角

- **舱内第一视角**：视点位于气泡舷窗内，透过**巨型透明舷窗**观赏太空美景；底部全息控制台点击可收起/展开（快捷键 `C`）；外观部件自动隐藏保证视野无遮挡
- **舱外第三视角**：后上方追踪镜头，完整呈现飞船与周围天体
- `V` 键或控制台按钮一键切换

---

## 部署结构

- 分支 `main` 为源码；GitHub Pages 从 `main` 根目录部署
- `vite.config.js` 中 `base: './'`（相对路径），同时兼容 Pages 子路径与本地预览
- 行星贴图在 `public/textures/`，全部本地资源，无外部 API 依赖
- 飞船为**程序化 3D 建模**（`src/three/ship/createStarship.js`），无外部模型文件，原创设计致敬星球大战风格

## 代码结构（新增部分）

```
src/
├── three/ship/
│   ├── createStarship.js   # 飞船程序化建模（机身/四翼/引擎/座舱/内饰）
│   └── ShipSystem.js       # 飞行状态机、自动驾驶、观赏锁定、双视角相机
├── components/
│   └── CockpitHud.jsx      # 驾驶舱 HUD（舷窗相框/控制台/导航列表/状态条）
└── styles/
    └── cockpit.css         # FUI 驾驶舱样式（琥珀/青全息风格）
```

修改指引：

- **调整飞船外观/涂装**：`src/three/ship/createStarship.js` 顶部颜色常量
- **调整飞行手感**（速度/转向/观赏距离）：`src/three/ship/ShipSystem.js` 构造函数参数区
- **调整观赏点逻辑**：`ShipSystem.js` 中 `_computeViewPosition()`（`viewFactor` 控制距离）
- **新增导航目标**：`src/data/planetData.js` 或 `SolarSystemScene.createNamedAsteroids()`
- **HUD 文案与布局**：`src/components/CockpitHud.jsx` + `src/styles/cockpit.css`

## 异常兜底

- WebGL 不可用 / 渲染异常：页面显示友好错误浮层，不白屏（React 错误边界 + 全局错误捕获）
- 后期管线（Bloom 等）初始化失败：自动退回普通渲染
- 贴图加载失败：6 秒后强制关闭加载页，场景仍可进入
- 导航目标不存在：HUD 提示「导航目标未找到」，飞行状态不受影响
- 观赏锁定数据异常：自动重新计算最佳观赏点
- 相机 / 飞船防穿模：太阳与行星碰撞守卫，不会进入天体内部

## 版本与回滚

```bash
git tag -l                       # 查看所有版本标签
git checkout v1.0.0              # 检出指定版本
git revert <commit>              # 撤销某次提交并推送回滚
```

回滚线上 Pages：将 main 分支重置到目标标签后强制推送
（`git reset --hard v1.0.1 && git push -f origin main`），
或直接在 GitHub 仓库 Releases 页面操作。当前版本：**v1.0.1**（v1.0.0 初始发布；v1.0.1 自动驾驶收敛与追踪优化）。

---

基于原项目 [sy-826](https://github.com/chenbenkong/sy-826) 构建 · React 18 / Three.js 0.160 / Vite 5
