const { expect, test } = require("@playwright/test");

const JEOPARDY_TEST_GAME_ID = "ui-scaling";
const JEOPARDY_TEST_GAME_TITLE = "UI Scaling Test";

async function openHome(page) {
	await page.addInitScript(() => localStorage.clear());
	await page.goto(`/?game=${JEOPARDY_TEST_GAME_ID}#/home`);
	await expect(page.locator("#game-title")).toHaveText(JEOPARDY_TEST_GAME_TITLE);
}

test("upload manager can upload, show and delete files", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await openHome(page);

	await expect(page.locator("#upload-manager")).toBeVisible();
	await expect(page.locator("#upload-manager-list")).toContainText("Ingen uploadede filer.");
	await expect(page.locator("#upload-manager-admin-status")).toHaveText("Log ind som admin for at uploade og slette filer.");
	await expect(page.locator("#upload-manager-upload-button")).toBeDisabled();
	await expect(page.getByRole("button", { name: "Brug link" })).toHaveCount(0);

	await page.locator("#upload-manager-admin-password").fill("playwright-admin");
	await page.locator("#upload-manager-admin-login-button").click();
	await expect(page.locator("#upload-manager-admin-status")).toHaveText("Logget ind som admin. Du kan uploade og slette filer.");
	await expect(page.locator("#upload-manager-upload-button")).toBeEnabled();

	await page.locator("#upload-manager-file").setInputFiles({
		name: "builder upload.png",
		mimeType: "image/png",
		buffer: Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
			"base64"
		),
	});
	await page.locator("#upload-manager-upload-button").click();
	await expect(page.locator("#upload-manager-status")).toHaveText("Filen er uploadet.");

	const uploadedRow = page.locator("#upload-manager-list tr").filter({ hasText: /\/uploads\/.*\.png/ });

	await expect(uploadedRow).toBeVisible();
	await expect(uploadedRow.locator(".upload-manager-preview img")).toBeVisible();
	await expect(uploadedRow.getByRole("button", { name: "Kopier" })).toBeVisible();
	await expect(uploadedRow.getByRole("button", { name: "Slet" })).toBeEnabled();
	await expect(page.getByRole("button", { name: "Brug link" })).toHaveCount(0);

	await uploadedRow.getByRole("button", { name: "Slet" }).click();
	await expect(page.locator("#upload-manager-status")).toHaveText("Filen er slettet.");
	await expect(page.locator("#upload-manager-list")).toContainText("Ingen uploadede filer.");
});
