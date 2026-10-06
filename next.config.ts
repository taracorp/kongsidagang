import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "Loji" diganti "Lapak" (Okt 2026): tautan lama tetap jalan.
  async redirects() {
    return [
      { source: "/loji", destination: "/lapak", permanent: true },
      { source: "/loji/:slug", destination: "/lapak/:slug", permanent: true },
    ];
  },
  experimental: {
    // Foto Tukar Guling maks 5 MB (lib/uploads.ts) + overhead multipart.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
