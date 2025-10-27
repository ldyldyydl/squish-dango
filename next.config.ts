import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// Allow explicit base path via NEXT_PUBLIC_BASE_PATH (e.g. "/WhatToEat") or infer from repo name
const explicitBase = process.env.NEXT_PUBLIC_BASE_PATH || "";
const repoName = process.env.NEXT_PUBLIC_REPO_NAME || "";
const baseSegment = explicitBase
  ? explicitBase.replace(/^\/+/, "").replace(/\/+$/, "")
  : repoName;
const basePath = isProd && baseSegment ? `/${baseSegment}` : "";
// Use basePath directly to avoid double slashes in asset URLs
const assetPrefix = basePath || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
