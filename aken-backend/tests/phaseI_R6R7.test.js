const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const FE_PUBLIC = path.join(__dirname, "..", "..", "aken-frontend", "public");
const FE_SRC = path.join(__dirname, "..", "..", "aken-frontend", "src");
const BE_DIR = path.join(__dirname, "..", "..", "aken-backend");

describe("R6 — Media assets present in public/", () => {
  const requiredAssets = ["hero-steel.jpg", "engineers-blueprint.jpg", "logo/logo.svg"];
  for (const asset of requiredAssets) {
    it(`${asset} exists`, () => {
      assert.ok(fs.existsSync(path.join(FE_PUBLIC, asset)), `Missing: ${asset}`);
    });
  }

  it("projects page references gallery images (company must provide)", () => {
    const content = fs.readFileSync(path.join(FE_SRC, "app", "projects", "page.tsx"), "utf8");
    const refs = content.match(/\/projects\/[^"']+\.jpg/g) || [];
    assert.ok(refs.length >= 5, `Expected at least 5, got ${refs.length}`);
  });

  it("HeroMedia has poster fallback for missing video files", () => {
    const content = fs.readFileSync(path.join(FE_SRC, "components", "HeroMedia.tsx"), "utf8");
    assert.ok(content.includes("/hero-steel.jpg"), "Poster fallback present");
    assert.ok(content.includes("/hero-fabrication.mp4"), "Video reference present");
  });

  it("Projects video references MP4 and poster", () => {
    const content = fs.readFileSync(path.join(FE_SRC, "app", "projects", "page.tsx"), "utf8");
    assert.ok(content.includes("/projects/videos/crane-lifting-structure-erection.mp4"));
    assert.ok(content.includes("/projects/video-posters/crane-lifting-structure-erection.jpg"));
  });
});

describe("R7 — Backend env var inventory", () => {
  it("envValidation checks all critical vars", () => {
    const v = fs.readFileSync(path.join(BE_DIR, "utils", "envValidation.js"), "utf8");
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET", "CORS_ORIGINS", "RESEND_API_KEY", "WHATSAPP_WEBHOOK_URL"].forEach(k => {
      assert.ok(v.includes(k), `envValidation should check ${k}`);
    });
  });

  it(".env.example documents all vars", () => {
    const ex = fs.readFileSync(path.join(BE_DIR, ".env.example"), "utf8");
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET", "CORS_ORIGINS",
     "RESEND_API_KEY", "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_SECRET",
     "WHATSAPP_WEBHOOK_URL", "DEFAULT_COUNTRY_CODE", "QUOTATION_GENERATE_PDF",
     "COOKIE_DOMAIN", "EMAIL_FROM", "LEAD_ALERT_EMAILS"].forEach(k => {
      assert.ok(ex.includes(k), `.env.example should document ${k}`);
    });
  });

  it("No legacy SMTP_ vars used in backend (uses Resend)", () => {
    const files = fs.readdirSync(path.join(BE_DIR, "utils"));
    files.filter(f => f.endsWith(".js") && f !== "sendEmail.js").forEach(f => {
      const c = fs.readFileSync(path.join(BE_DIR, "utils", f), "utf8");
      assert.ok(!c.includes("SMTP_"), `${f} should not reference SMTP_`);
    });
  });

  it("supabaseClient requires only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", () => {
    const c = fs.readFileSync(path.join(BE_DIR, "utils", "supabaseClient.js"), "utf8");
    assert.ok(c.includes("SUPABASE_URL"));
    assert.ok(c.includes("SUPABASE_SERVICE_ROLE_KEY"));
  });
});
