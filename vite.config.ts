import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type HealthState = "ready" | "warning" | "offline" | "info";

type HealthCheck = {
  detail: string;
  key: string;
  label: string;
  state: HealthState;
};

const CHECK_TIMEOUT_MS = 1800;

function withTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function json(res: import("node:http").ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

async function buildHealth(env: Record<string, string>, root: string) {
  const checks: HealthCheck[] = [];
  const lmStudioBaseUrl = env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
  const lmStudioModel = env.LM_STUDIO_MODEL || "local-model";
  const lexiaBaseUrl = env.LEXIA_BASE_URL || "http://127.0.0.1:5174";
  const workspace = env.AI_NATIVE_OS_WORKSPACE || "~/AI-Native-OS";
  const bridgePython = env.R_BRIDGE_PYTHON || resolve(root, ".venv/bin/python");
  const bridgeScript = env.R_BRIDGE_SCRIPT || resolve(root, "scripts/r_bridge.py");
  const catalogPath = resolve(root, "public/r-catalog.json");

  try {
    const response = await withTimeout(`${lmStudioBaseUrl.replace(/\/$/, "")}/models`, {
      headers: { authorization: `Bearer ${env.LM_STUDIO_API_KEY || "lm-studio"}` },
    });
    if (!response.ok) {
      checks.push({
        key: "lmstudio",
        label: "LM Studio",
        state: "offline",
        detail: `${response.status} ${response.statusText}`,
      });
    } else {
      const data = (await response.json()) as { data?: Array<{ id?: string }> };
      const ids = Array.isArray(data.data) ? data.data.map((model) => model.id).filter(Boolean) : [];
      checks.push({
        key: "lmstudio",
        label: "LM Studio",
        state: ids.includes(lmStudioModel) ? "ready" : "warning",
        detail: ids.includes(lmStudioModel)
          ? `${lmStudioModel} is available`
          : `${lmStudioModel} not found; ${ids.length} model(s) reported`,
      });
    }
  } catch {
    checks.push({
      key: "lmstudio",
      label: "LM Studio",
      state: "offline",
      detail: `Not reachable at ${lmStudioBaseUrl}`,
    });
  }

  if (existsSync(catalogPath)) {
    try {
      const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
        skillCount?: number;
        toolCount?: number;
      };
      checks.push({
        key: "catalog",
        label: "R catalog",
        state: catalog.skillCount && catalog.toolCount ? "ready" : "warning",
        detail: `${catalog.skillCount ?? 0} skills, ${catalog.toolCount ?? 0} tools`,
      });
    } catch {
      checks.push({
        key: "catalog",
        label: "R catalog",
        state: "warning",
        detail: "public/r-catalog.json exists but could not be parsed",
      });
    }
  } else {
    checks.push({
      key: "catalog",
      label: "R catalog",
      state: "warning",
      detail: "Run npm run r:catalog",
    });
  }

  checks.push({
    key: "bridge",
    label: "R bridge",
    state: existsSync(bridgePython) && existsSync(bridgeScript) ? "ready" : "warning",
    detail:
      existsSync(bridgePython) && existsSync(bridgeScript)
        ? "Python bridge files are present"
        : "Run npm run r:install",
  });

  try {
    const response = await withTimeout(`${lexiaBaseUrl.replace(/\/$/, "")}/api/agent/health`, {
      headers: env.LEXIA_AGENT_TOKEN ? { authorization: `Bearer ${env.LEXIA_AGENT_TOKEN}` } : undefined,
    });
    checks.push({
      key: "lexia",
      label: "Lexia",
      state: response.ok ? "ready" : "warning",
      detail: response.ok ? "Spanish legal RAG is reachable" : `${response.status} ${response.statusText}`,
    });
  } catch {
    checks.push({
      key: "lexia",
      label: "Lexia",
      state: "info",
      detail: "Optional legal RAG is not running",
    });
  }

  checks.push({
    key: "search",
    label: "Web search",
    state: env.SEARXNG_URL || env.BRAVE_SEARCH_API_KEY || env.TAVILY_API_KEY ? "ready" : "warning",
    detail: env.SEARXNG_URL
      ? "SearXNG configured"
      : env.BRAVE_SEARCH_API_KEY
        ? "Brave configured"
        : env.TAVILY_API_KEY
          ? "Tavily configured"
          : "DuckDuckGo fallback only",
  });

  checks.push({
    key: "workspace",
    label: "Workspace",
    state: "info",
    detail: `${workspace}${env.R_BRIDGE_WORKSPACE_ONLY === "1" ? " (workspace-only)" : ""}`,
  });

  return {
    generatedAt: new Date().toISOString(),
    checks,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "ai-native-os-health",
        configureServer(server) {
          server.middlewares.use("/api/health", async (_req, res) => {
            try {
              json(res, 200, await buildHealth(env, process.cwd()));
            } catch (error) {
              json(res, 500, {
                generatedAt: new Date().toISOString(),
                checks: [],
                error: error instanceof Error ? error.message : String(error),
              });
            }
          });
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        "/eve": {
          target: env.VITE_EVE_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
