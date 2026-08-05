const { createClient } = require("@supabase/supabase-js");

let cachedClient = null;
let cachedKey = null;

function assertSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !serviceRoleKey) {
    const error = new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
    error.code = "SUPABASE_CONFIG_MISSING";
    throw error;
  }

  return { url, serviceRoleKey };
}

function getSupabaseClient() {
  const { url, serviceRoleKey } = assertSupabaseConfig();
  const cacheKey = `${url}|${serviceRoleKey.length}`;

  if (cachedClient && cachedKey === cacheKey) {
    return cachedClient;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Identify this client in Supabase logs/metrics.
        "x-application-name": "aken-backend",
      },
    },
  });

  cachedKey = cacheKey;
  return cachedClient;
}

function isSupabaseConfigured() {
  return Boolean((process.env.SUPABASE_URL || "").trim()) &&
    Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

module.exports = {
  getSupabaseClient,
  isSupabaseConfigured,
};
