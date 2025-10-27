# 项目详细解决方案

## 问题分析（玫瑰花自动晃动）
- 现象：在未交互状态下，玫瑰形软体持续轻微抖动与晃动，且难以进入“静止”。
- 根因汇总：
  - 锚点吸附持续施力：采样锚点用于保持外形，但在数值误差与离散约束下形成持续微力，导致能量无法快速耗散。
  - 初始速度未清零：切换形状或重置过程中部分粒子保留上一状态的速度/角速度，导致新的形状初始即带动能。
  - 睡眠未启用：物理引擎未在低速/低能量时自动休眠，微振动会被持续积分而放大到可见水平。

## 解决方案（已实施）
- 提高空气阻尼与回弹阻尼：抑制非交互时的残余能量与弱周期晃动。
- 启用/增强睡眠机制：当速度与加速度低于阈值时休眠，防止能量继续积累。
- 锚点贴附（Snap/Stickiness）：在近距离范围内对外轮廓采样点施加贴附，而非持续弹簧拉力，降低抖动。
- 清零初始速度：在形状切换与重置流程中统一清除速度与角速度，避免携带旧动能。
- 圆角与曲线平滑：
  - 多边形角点加权平滑（`setCornerSmooth`），减少锐角引起的局部刚性。
  - 心形曲线应用环形移动平均（迭代 3 次，alpha=0.35），心尖更圆润、整体更顺滑。

## 关键代码位置
- `src/core/PhysicsEngine.ts`
  - 空气阻尼设置：`setFrictionAir(outer, center)`
  - 睡眠逻辑：低速阈值检测与休眠标记
  - 锚点吸附：`setAnchorStrength(base, interact)` 与贴附阈值处理
- `src/core/GameManager.ts`
  - 交互态切换：`setInteracting(active)`
  - 角点平滑：`setCornerSmooth(ratio)`
  - 形状重置：`resetShape(...)`、`resetAnchoredShape(anchors)`（负责重新绑定输入与清零状态）
- `src/components/GameCanvas.tsx`
  - 形状生成：`makeRoseAnchors(...)`、`makeHeartAnchors(...)`、`makeRegularPolygonAnchors(...)`、`makeStarAnchors(...)`
  - 心形平滑：在 `makeHeartAnchors` 中加入移动平均平滑；心形圆角 `setCornerSmooth(0.35)`
  - UI 控制与形状切换：`onShapeChange`
- `next.config.ts`
  - 静态导出与 GitHub Pages 的 `basePath` 自动适配

## 验证与发布
- 本地预览：`npm run dev`，在 `http://localhost:3000/` 确认非交互状态下不再自动晃动。
- 部署：推送到 `main` 分支触发 GitHub Actions，自动构建与静态导出到 Pages。
- 近期提交：
  - `93df0b5` 物理稳定性（阻尼、睡眠、锚点吸附、清零初速）
  - `8d4ebca` UI 面板位置调整（左上角）与心形加入
  - `373c4f4` 心形曲线平滑与更高采样

## 后续可调参数建议
- 空气阻尼：`outer=0.015~0.028`、`center=0.012~0.022`
- 锚点强度：`base=0.10~0.16`、`interact=0.24~0.34`
- 圆角平滑：多边形 `0.24~0.32`，心形 `0.32~0.40`
- 心形平滑迭代：`2~4` 次；`alpha=0.25~0.45`
