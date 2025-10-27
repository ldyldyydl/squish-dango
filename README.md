# Squish Dango｜揉团子解压小游戏

- 在线体验：`https://ldyldyydl.github.io/squish-dango/`
- 技术栈：Next.js + TypeScript + Canvas（自研软体物理与交互）

## 快速开始
- 安装依赖：`npm install`
- 开发：`npm run dev`，浏览 `http://localhost:3000/`
- 构建：`npm run build`（Next App Router）
- 静态导出：`npm run export`（输出到 `./out`，用于 GitHub Pages）

## 玩法说明
- 文档：`PLAY.md`
- 操作：拖拽/揉捏软体，感受形变与回弹；左上角可切换颜色与形状（圆形/多边形/星形/玫瑰/心形）。

## 项目方案与实验
- 详细解决方案与分析：`docs/solution.md`
- 实验过程与数据：`docs/experiments.md`
- 运行与部署要求：`docs/run.md`

## 代码位置
- 页面与控制面板：`src/app/page.tsx`、`src/components/GameCanvas.tsx`
- 交互与物理：`src/core/GameManager.ts`、`src/core/InputController.ts`、`src/core/PhysicsEngine.ts`
- 渲染：`src/core/RenderManager.ts`
- 部署配置：`next.config.ts`、`.github/workflows/deploy.yml`

## 部署
- 推送到 `main` 分支后，GitHub Actions 自动构建并静态导出到 GitHub Pages。
- 页面基路径 `basePath` 根据仓库名自动设置，适配 `https://<user>.github.io/<repo>/`。

## 近期更新
- `373c4f4` Heart：提升采样并加入曲线平滑，心形更圆润。
- `8d4ebca` UI：颜色/形状控制面板移动到左侧并垂直排列。
- `93df0b5` Physics：玫瑰形稳定性修复（阻尼、睡眠、锚点吸附、清零初速）。
