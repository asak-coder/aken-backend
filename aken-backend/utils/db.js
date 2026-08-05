const { getSupabaseClient, isSupabaseConfigured } = require("./supabaseClient");
const { log } = require("./requestLogger");

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

function sanitizeSupabaseUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "[invalid]";
  }
}

async function connectToDatabase() {
  if (!isSupabaseConfigured()) {
    const error = new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing",
    );
    error.code = "SUPABASE_CONFIG_MISSING";
    throw error;
  }

  const connectTimeoutMS = Number(
    process.env.SUPABASE_CONNECT_TIMEOUT_MS || DEFAULT_CONNECT_TIMEOUT_MS,
  );

  log("info", null, "Connecting to Supabase PostgreSQL", {
    supabaseUrl: sanitizeSupabaseUrl(process.env.SUPABASE_URL),
    connectTimeoutMS,
  });

  const client = getSupabaseClient();

  // Connectivity/health check: SELECT 1 against the Postgres instance.
  // The service-role client uses the PostgREST endpoint. A lightweight
  // metadata/health call confirms the project is reachable.
  const checkResult = await Promise.race([
    client.from("users").select("id", { count: "exact", head: true }),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Supabase connection timed out")),
        connectTimeoutMS,
      ),
    ),
  ]);

  if (checkResult.error) {
    const error = new Error(
      `Supabase connection failed: ${checkResult.error.message}`,
    );
    error.code = "SUPABASE_CONNECT_FAILED";
    throw error;
  }

  log("info", null, "Supabase PostgreSQL connected", {
    table: "users",
    reachable: true,
  });

  return client;
}

module.exports = {
  connectToDatabase,
};
