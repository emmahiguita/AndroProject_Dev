import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // En desarrollo Next reenvía también las imágenes y las rutas relativas a Rust.
  ...(process.env.NODE_ENV === "development"
    ? { rewrites: async () => [{ source: "/api/:path*", destination: "http://127.0.0.1:3000/api/:path*" }] }
    : { output: "export" as const }),
  images: { unoptimized: true },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
