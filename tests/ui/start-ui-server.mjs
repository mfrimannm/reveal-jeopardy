import { spawn, spawnSync } from "node:child_process";
import "./seed-ui-data.mjs";

const python = process.env.PYTHON || "python";
const port = process.env.PORT || "8010";
const maxRuntimeMs = Number(process.env.UI_SERVER_MAX_MS || 45000);
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

setTimeout(stopServer, maxRuntimeMs);
