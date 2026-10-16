import path from "path";

export default {
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "."),
    },
  },
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/hash.ts",
        "lib/timezone.ts",
        "lib/r2-storage.ts",
        "lib/rate-limit.ts",
        "lib/email.ts",
        "lib/audit-log.ts",
        "app/api/appraisal/route.ts",
        "app/api/reports/download/route.ts",
        "app/house/page.tsx",
        "app/townhouse/page.tsx",
        "app/api/capture-intent/route.ts",
        "app/api/submit-appraisal/route.ts",
        "components/AppraisalSection.tsx",
        "components/ReportDownloadSection.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ["text", "text-summary", "html"],
    },
  },
};
