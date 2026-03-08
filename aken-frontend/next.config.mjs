/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async redirects() {
    return [
      // Canonical host enforcement: www -> non-www
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.aken.firm.in" }],
        destination: "https://aken.firm.in/:path*",
        permanent: true,
      },
      // Defensive: if a bad rule ever sends users to /X, redirect back to home.
      {
        source: "/X",
        destination: "/",
        permanent: true,
      },
    ];
  },

  /**
   * Try to override any platform-level header injection (e.g. Vercel project/team headers).
   * We explicitly do NOT want ACAO on normal HTML pages.
   *
   * Note: If a team-level rule appends ACAO after this, code cannot fully override it.
   * In that case an admin must remove the global rule.
   */
  async headers() {
    return [
      {
        // Apply to all pages + assets served by Next (safe to include; we explicitly set empty)
        source: "/:path*",
        headers: [
          // Remove wildcard CORS on pages; browsers treat empty as not present.
          { key: "Access-Control-Allow-Origin", value: "" },
        ],
      },
    ];
  },
};

export default nextConfig;
