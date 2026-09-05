import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack: pin root so it doesn't climb to the parent git repo
  turbopack: {
    root: __dirname,
  },
  images: {
    // Netlify serves + optimizes images at the edge; the Next optimizer adds
    // a hop that also 404s on some dev networks. Skip it.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.vmg.co.za" },
      { protocol: "https", hostname: "cdn.tru-saas.com" },
    ],
  },
};

export default nextConfig;
