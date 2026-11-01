import { varlockNextConfigPlugin } from "@varlock/nextjs-integration/plugin";
import type { NextConfig } from "next";

const withVarlock = varlockNextConfigPlugin();
const SERVER_URL = "http://server:3000";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  output: "standalone",
  transpilePackages: ["shiki"],
  async rewrites() {
    return [
      {
        source: "/rpc/:path*",
        destination: `${SERVER_URL}/rpc/:path*`,
      },
      {
        source: "/api/auth/:path*",
        destination: `${SERVER_URL}/api/auth/:path*`,
      },
    ];
  },
};

export default withVarlock(nextConfig);