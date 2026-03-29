import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  // Avoid dev-only "SegmentViewNode" / React Client Manifest errors with App Router (Next 15+).
  experimental: {
    devtoolSegmentExplorer: false
  }
};

export default nextConfig;
