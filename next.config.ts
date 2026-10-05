import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Foto Tukar Guling maks 5 MB (lib/uploads.ts) + overhead multipart.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
