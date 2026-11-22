import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
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
