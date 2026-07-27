/**
 * Lighthouse CI — Mobile Configuration
 *
 * Runs Lighthouse against representative pages with mobile throttling.
 * Uses a puppeteer login script for authenticated routes.
 *
 * Budget thresholds:
 *   Performance ≥ 75 unauthenticated / 85 authenticated,
 *   Accessibility ≥ 95, Best Practices ≥ 90,
 *   CLS < 0.1
 *
 * @see https://github.com/ericsocrat/tryvit/issues/177
 */

const QA_PRODUCT_ID = process.env.QA_PRODUCT_ID ?? "1";
const hasQaCredentials = Boolean(
  process.env.QA_TEST_EMAIL && process.env.QA_TEST_PASSWORD,
);
const AUDIT_URLS = [
  "http://localhost:3000/auth/login",
  "http://localhost:3000/app",
  `http://localhost:3000/app/product/${QA_PRODUCT_ID}`,
];

// Protected routes redirect to login without QA credentials, so auditing them
// would measure the same login page under several URLs rather than those routes.
const urls = hasQaCredentials ? AUDIT_URLS : AUDIT_URLS.slice(0, 1);
// Authenticated representative routes retain the original 0.85 target. The
// public login route uses the stable 0.75 CI baseline measured on runners.
const performanceMinScore = hasQaCredentials ? 0.85 : 0.75;

module.exports = {
  ci: {
    collect: {
      startServerCommand: "cd frontend && npm run start -- -p 3000",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 30000,
      url: urls,
      numberOfRuns: 3,
      puppeteerScript: "./frontend/tests/quality/lighthouse-auth.js",
      puppeteerLaunchOptions: {
        args: ["--no-sandbox", "--disable-gpu"],
      },
      settings: {
        formFactor: "mobile",
        chromeFlags: "--no-sandbox --headless --disable-gpu",
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
        ],
        throttling: {
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 150,
          downloadThroughputKbps: 1600,
          uploadThroughputKbps: 750,
        },
        // Suppress noisy audits that vary across CI runners
        skipAudits: ["uses-http2"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: performanceMinScore }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "lighthouse-reports",
    },
  },
};
