import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database drivers run only on the server and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
