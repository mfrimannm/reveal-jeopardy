import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "./seed-ui-data.mjs";

const rootDir = process.cwd();
const localPython =
	process.platform === "win32"
		? path.join(rootDir, ".venv", "Scripts", "python.exe")
		: path.join(rootDir, ".venv", "bin", "python");
const systemPython = process.platform === "win32" ? "python" : "python3";
const python = process.env.PYTHON || (fs.existsSync(localPython) ? localPython : systemPython);
const port = process.env.PORT || "8010";
const maxRuntimeMs = Number(process.env.UI_SERVER_MAX_MS || 0);
const server = spawn(
	python,
	["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", port],
	{
		env: process.env,
		stdio: "inherit",
	}
);

function stopServer() {
	if (process.platform === "win32" && server.pid) {
		spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
			stdio: "ignore",
		});
		process.exit(0);
	}

	if (!server.killed) {
		server.kill();
	}

	process.exit(0);
}

process.on("SIGINT", stopServer);
process.on("SIGTERM", stopServer);

server.on("exit", (code, signal) => {
	if (signal) {
		process.exit(0);
	}

	process.exit(code || 0);
});

if (maxRuntimeMs > 0) {
	setTimeout(stopServer, maxRuntimeMs);
}
