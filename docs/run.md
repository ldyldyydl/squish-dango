# 运行与部署要求

## 环境要求
- Node.js：`>= 18`
- 包管理器：`npm >= 9`（或 `pnpm/yarn/bun` 均可）
- 浏览器：现代浏览器（Chrome/Edge/Safari），移动端与桌面端均可

## 本地开发
- 安装依赖：`npm install`
- 启动开发：`npm run dev`
- 访问：`http://localhost:3000/`

## 构建与导出
- 构建：`npm run build`
- 静态导出：`npm run export`（输出到 `./out`）
- 注意：`next.config.ts` 设置 `output: "export"`，并根据仓库名自动设置 `basePath`，适配 GitHub Pages 子路径。

## 部署（GitHub Pages）
- 推送到 `main` 分支后，触发 `.github/workflows/deploy.yml`。
- 流程：安装依赖 → 构建 → 静态导出到 `./out` → 上传到 Pages。
- 访问地址：`https://ldyldyydl.github.io/squish-dango/`

## 常见问题
- 页面路径前缀：使用 `basePath` 自动适配，无需手动设置环境变量。
- 本地 404：若开启自定义路径前缀，请确保开发环境与生产一致；默认无需配置。
- 画面模糊：在高分屏上可适当调整浏览器缩放或窗口大小。
