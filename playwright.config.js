const { defineConfig, devices } = require("@playwright/test");

const PORT = 8010;
const TEST_DATA_DIR = "/tmp/reveal-jeopardy-playwright-data";

module.exports = defineConfig({
	testDir: "tests/ui",
	timeout: 30 * 1000,
	expect: {
		timeout: 10 * 1000,
	},
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command:
			`node tests/ui/seed-ui-data.mjs && DATA_DIR=${TEST_DATA_DIR} ADMIN_PASSWORD=playwright-admin SESSION_SECRET=playwright-secret MAX_UPLOAD_MB=1 python3 -m uvicorn server:app --host 127.0.0.1 --port ${PORT}`,
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 30 * 1000,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
	],
});
