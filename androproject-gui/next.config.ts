import type { NextConfig } from "next";
import path from "path";

const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  images: { unoptimized: true },
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/next/dist/compiled/next-server/*.prod.js'],
  },
  outputFileTracingExcludes: {
    '*': [
      './dist/**',
      './src-tauri/**',
      './bin/airplay/*.zip',
      './bin/airplay/*.bak',
      './temp/**',
      './.cache/**',
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost', 'app://-', 'file://'],
};

export default nextConfig;
