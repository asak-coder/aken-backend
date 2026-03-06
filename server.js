require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectToDatabase } = require("./utils/db");
const helmet = require("helmet");
const morgan = require("morgan");
const { apiLimiter } = require("./middleware/rateLimiters");
const { requestIdMiddleware, log } = require("./utils/requestLogger");
const { sendError } = require("./utils/apiResponse");
const {
  assertBackendEnvForStartup,
  getBackendEnvDiagnostics,
} = require("./utils/envValidation");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

const isProduction = process.env.NODE_ENV === "production";
const startupEnvDiagnostics = assertBackendEnvForStartup();

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsOriginDelegate(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const normalizedOrigin = String(origin).replace(/\/$/, "");
  const normalizedAllowlist = allowedOrigins.map((o) => String(o).replace(/\/$/, ""));

  if (normalizedAllowlist.includes(normalizedOrigin)) {
    // IMPORTANT: return the exact origin string so the CORS middleware
    // emits `Access-Control-Allow-Origin: <origin>` (required with credentials).
    callback(null, origin);
    return;
  }

  callback(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
}

const corsOptions = {
  origin: corsOriginDelegate,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "deny" },
    hsts: isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "no-referrer" },
    xDnsPrefetchControl: { allow: false },
  })
);
app.use(requestIdMiddleware);
app.use(cookieParser());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
if (process.env.NODE_ENV === "production") {
  app.use(
    morgan((tokens, req, res) =>
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "http",
        requestId: req.requestId,
        method: tokens.method(req, res),
        path: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        responseTimeMs: Number(tokens["response-time"](req, res)),
        userAgent: tokens["user-agent"](req, res),
      }),
    ),
  );
} else {
  app.use(morgan("dev"));
}
app.use("/api", apiLimiter);

const leadRoutes = require("./routes/leadRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const projectRoutes = require("./routes/projectRoutes");
const revenueRoutes = require("./routes/revenueRoutes");
const exportRoutes = require("./routes/exportRoutes");
const systemRoutes = require("./routes/systemRoutes");
const authRoutes = require("./routes/authRoutes");
const bootstrapRoutes = require("./routes/bootstrapRoutes");

app.use("/api/leads", leadRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bootstrap", bootstrapRoutes);
app.get("/health", (_req, res) => {
  const latestDiagnostics = getBackendEnvDiagnostics();
  res.status(200).json({
    status: "ok",
    envReady: latestDiagnostics.summary.readyForProduction,
    envWarnings: latestDiagnostics.summary.warningCount,
  });
});

app.use((req, res) => {
  sendError(res, req, {
    statusCode: 404,
    code: "ROUTE_NOT_FOUND",
    message: "Route not found",
  });
});

app.use((err, req, res, _next) => {
  if (err.message && err.message.startsWith("CORS blocked")) {
    sendError(res, req, {
      statusCode: 403,
      code: "CORS_BLOCKED",
      message: "CORS not allowed for this origin",
      err,
    });
    return;
  }

  if (err.type === "entity.parse.failed") {
    sendError(res, req, {
      statusCode: 400,
      code: "BAD_JSON",
      message: "Invalid JSON payload.",
      err,
    });
    return;
  }

  sendError(res, req, {
    statusCode: 500,
    code: "UNHANDLED_ERROR",
    message: "Internal server error",
    err,
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      if (startupEnvDiagnostics.summary.criticalFailureCount > 0) {
        log("warn", null, "Backend environment has critical configuration issues", {
          criticalFailureCount: startupEnvDiagnostics.summary.criticalFailureCount,
          readyForProduction: startupEnvDiagnostics.summary.readyForProduction,
        });
      }

      if (startupEnvDiagnostics.summary.warningCount > 0) {
        log("warn", null, "Backend environment has non-critical warnings", {
          warningCount: startupEnvDiagnostics.summary.warningCount,
        });
      }

      log("info", null, `Server running on port ${PORT}`);
    });
  } catch (error) {
    log("error", null, "Backend failed to start", {
      errMessage: error?.message,
    });
    process.exit(1);
  }
}

startServer();
