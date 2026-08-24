import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
const app = express();

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

app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    res.status(403).json({ success: false, error: "Origin is not allowed" });
    return;
  }
  next();
});
app.use(
  cors({
    origin: true,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
    maxAge: 600,
  }),
);
app.use(express.json({ limit: "100kb" }));

const hadithAppPromise = import("../../src/server/routes/hadith-books").then(({ default: router }) => {
  const routeApp = express();
  routeApp.use("/api/hadith", router);
  return routeApp;
});

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  console.error(
    "Hadith API error:",
    error instanceof Error ? error.message : "unknown",
  );
  res.status(500).json({ success: false, error: "Internal server error" });
});

const handler = async (req: Request, res: Response) => {
  try {
    const hadithApp = await hadithAppPromise;
    hadithApp(req, res);
  } catch (error) {
    console.error(
      "Hadith route initialization error:",
      error instanceof Error ? error.message : "unknown",
    );
    res.status(500).json({ success: false, error: "Hadith route initialization failed" });
  }
};

export default handler;
