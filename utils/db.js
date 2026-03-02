const mongoose = require("mongoose");
const { log } = require("./requestLogger");

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 45_000;

function sanitizeMongoUri(uri) {
  if (!uri) return "";
  try {
    // Redact credentials if present: mongodb(+srv)://user:pass@host/...
    return uri.replace(/\/\/([^:/]+):([^@]+)@/g, "//***:***@");
  } catch {
    return "[redacted]";
  }
}

async function connectToDatabase() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    const error = new Error("MONGO_URI is missing");
    error.code = "MONGO_URI_MISSING";
    throw error;
  }

  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  // Recommended: disable autoIndex in production to avoid performance issues on cold start.
  mongoose.set("autoIndex", !isProduction);

  mongoose.connection.on("connected", () => {
    log("info", null, "MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    log("error", null, "MongoDB connection error", {
      errMessage: err?.message,
    });
  });

  mongoose.connection.on("disconnected", () => {
    log("warn", null, "MongoDB disconnected");
  });

  const connectTimeoutMS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || DEFAULT_CONNECT_TIMEOUT_MS);
  const socketTimeoutMS = Number(process.env.MONGO_SOCKET_TIMEOUT_MS || DEFAULT_SOCKET_TIMEOUT_MS);

  log("info", null, "Connecting to MongoDB", {
    mongoUri: sanitizeMongoUri(mongoUri),
    connectTimeoutMS,
    socketTimeoutMS,
    autoIndex: !isProduction,
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: connectTimeoutMS,
    socketTimeoutMS,
  });

  return mongoose.connection;
}

module.exports = {
  connectToDatabase,
};
