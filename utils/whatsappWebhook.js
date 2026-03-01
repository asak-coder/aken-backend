const DEFAULT_TIMEOUT_MS = 8000;

function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_WEBHOOK_URL);
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function sendWhatsAppViaWebhook(payload) {
  if (!isWhatsAppConfigured()) {
    const error = new Error(
      "WhatsApp webhook is not configured. Set WHATSAPP_WEBHOOK_URL.",
    );
    error.code = "WHATSAPP_NOT_CONFIGURED";
    throw error;
  }

  const timeoutMs = Number(process.env.WHATSAPP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (process.env.WHATSAPP_WEBHOOK_TOKEN) {
      headers.Authorization = `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}`;
    }

    const response = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawBody = await response.text();
    const responseBody = parseJsonSafe(rawBody);

    if (!response.ok) {
      const error = new Error(
        `WhatsApp webhook failed with status ${response.status}`,
      );
      error.code = "WHATSAPP_WEBHOOK_ERROR";
      error.statusCode = response.status;
      error.responseBody = responseBody;
      throw error;
    }

    return {
      ok: true,
      statusCode: response.status,
      responseBody,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("WhatsApp webhook request timed out.");
      timeoutError.code = "WHATSAPP_TIMEOUT";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  sendWhatsAppViaWebhook,
  isWhatsAppConfigured,
};
