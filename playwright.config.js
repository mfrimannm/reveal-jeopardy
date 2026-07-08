const { defineConfig, devices } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT_DIR = __dirname;
const PORT = 8010;
const TEST_DATA_DIR = path.join(os.tmpdir(), "reveal-jeopardy-playwright-data");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

const LOCAL_PYTHON =
	process.platform === "win32"
		? path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
		: path.join(ROOT_DIR, ".venv", "bin", "python");

const SYSTEM_PYTHON = process.platform === "win32" ? "python" : "python3";
const PYTHON = process.env.PYTHON || (fs.existsSync(LOCAL_PYTHON) ? LOCAL_PYTHON : SYSTEM_PYTHON);

const NODE = process.execPath;
const START_UI_SERVER = path.join(ROOT_DIR, "tests", "ui", "start-ui-server.mjs");

process.env.DATA_DIR = TEST_DATA_DIR;
process.env.ADMIN_PASSWORD = "playwright-admin";
process.env.SESSION_SECRET = "playwright-secret";
process.env.MAX_UPLOAD_MB = "1";
process.env.PYTHON = PYTHON;
process.env.PORT = String(PORT);
process.env.PLAYWRIGHT_BROWSERS_PATH =
	process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, ".playwright-browsers");

module.exports = defineConfig({
	testDir: "tests/ui",
	testMatch: '**/*.spec.js',
	timeout: 100 * 1000,
	expect: {
		timeout: 20 * 1000,
	},
	use: {
		browserName: 'chromium',
		baseURL: BASE_URL,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
		? undefined
		: {
			command: `"${NODE}" "${START_UI_SERVER}"`,
			cwd: ROOT_DIR,
			url: BASE_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 40 * 1000,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
	],
});
