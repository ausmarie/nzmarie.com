import type { NextConfig } from "next";
import path from 'path';

const isTurbo = process.argv.includes("--turbo") || process.argv.includes("--turbopack");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'reports.nzmarie.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  ...(isTurbo ? {} : {
    webpack: (config) => {
      config.module.exprContextCritical = false;
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      // Alias botpress webchat to a lightweight shim to avoid native asset bundling errors on Windows
      config.resolve.alias['@botpress/webchat'] = path.resolve(__dirname, './shims/botpress-webchat-stub.js');
      return config;
    },
  }),
  async redirects() {
    return [
      {
        source: "/appraisal",
        destination: "/#appraisal",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
