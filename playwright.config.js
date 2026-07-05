const { defineConfig, devices } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = 8010;
const TEST_DATA_DIR = path.join(os.tmpdir(), "reveal-jeopardy-playwright-data");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const LOCAL_PYTHON =
	process.platform === "win32"
		? path.join(".venv", "Scripts", "python.exe")
		: path.join(".venv", "bin", "python");
const PYTHON = process.env.PYTHON || (fs.existsSync(LOCAL_PYTHON) ? LOCAL_PYTHON : "python");

process.env.DATA_DIR = TEST_DATA_DIR;
process.env.ADMIN_PASSWORD = "playwright-admin";
process.env.SESSION_SECRET = "playwright-secret";
process.env.MAX_UPLOAD_MB = "1";
process.env.PYTHON = PYTHON;
process.env.PORT = String(PORT);
process.env.UI_SERVER_MAX_MS = process.env.UI_SERVER_MAX_MS || "90000";
process.env.PLAYWRIGHT_BROWSERS_PATH =
	process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, ".playwright-browsers");

module.exports = defineConfig({
	testDir: "tests/ui",
	timeout: 30 * 1000,
	expect: {
		timeout: 10 * 1000,
	},
	use: {
		baseURL: BASE_URL,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
		? undefined
		: {
		command: "node tests/ui/start-ui-server.mjs",
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 30 * 1000,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
	],
});
