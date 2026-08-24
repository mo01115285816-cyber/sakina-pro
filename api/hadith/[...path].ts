import type { IncomingMessage, ServerResponse } from "node:http";

export const config = {
  runtime: "nodejs",
};

const defaultAllowedOrigins = new Set([
  "https://sakina-design-transplant.vercel.app",
  "https://sakeenah-console.vercel.app",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  configuredOrigins.length > 0 ? configuredOrigins : defaultAllowedOrigins,
);

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(req, res);

  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(res, 403, { success: false, error: "Origin is not allowed" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  try {
    const [{ default: express }, { default: router }] = await Promise.all([
      import("express"),
      import("../../src/server/routes/hadith-books"),
    ]);
    const routeApp = express();
    routeApp.use("/api/hadith", router);
    routeApp(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Hadith route initialization error:", message);
    sendJson(res, 500, {
      success: false,
      error: "Hadith route initialization failed",
      detail: message,
    });
  }
}
