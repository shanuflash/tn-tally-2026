import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/scrape-progress": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/cron/scrape": ["./node_modules/@sparticuz/chromium/**/*"],
  },
};

export default nextConfig;
