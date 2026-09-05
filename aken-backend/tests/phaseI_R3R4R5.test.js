const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("R3 CSRF middleware", () => {
  const { csrfProtection } = require("../middleware/csrf");

  it("skips CSRF for GET", (_, done) => {
    csrfProtection({ method: "GET", cookies: {}, headers: {} }, {}, done);
  });

  it("skips CSRF for HEAD", (_, done) => {
    csrfProtection({ method: "HEAD", cookies: {}, headers: {} }, {}, done);
  });

  it("rejects POST with no CSRF token", () => {
    let status = null;
    const res = { status(c) { status = c; return this; }, json() { return this; } };
    csrfProtection({ method: "POST", cookies: {}, headers: {} }, res, () => {});
    assert.equal(status, 403);
  });

  it("rejects POST with mismatched CSRF", () => {
    let status = null;
    const res = { status(c) { status = c; return this; }, json() { return this; } };
    csrfProtection({ method: "POST", cookies: { aken_csrf: "A" }, headers: { "x-csrf-token": "B" } }, res, () => {});
    assert.equal(status, 403);
  });

  it("passes POST with matching CSRF", (_, done) => {
    csrfProtection({ method: "POST", cookies: { aken_csrf: "tok" }, headers: { "x-csrf-token": "tok" } }, {}, done);
  });
});

describe("R3 Auth cookie utils", () => {
  const ac = require("../utils/authCookies");

  it("CSRF_COOKIE_NAME is aken_csrf", () => {
    assert.equal(ac.CSRF_COOKIE_NAME, "aken_csrf");
  });

  it("issueCsrfToken returns 64-char hex", () => {
    const t = ac.issueCsrfToken();
    assert.equal(t.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(t));
  });

  it("issueCsrfToken returns unique tokens", () => {
    assert.notEqual(ac.issueCsrfToken(), ac.issueCsrfToken());
  });
});

describe("R4 Lead validation accepts flat estimator payload", () => {
  const { validateCreateLead } = require("../middleware/leadValidation");

  function call(body) {
    const req = { body, validatedLead: null };
    let called = false;
    const res = { status(c) { return { json() { return this; } }; }, json() { return this; } };
    validateCreateLead(req, res, () => { called = true; });
    return { called, validatedLead: req.validatedLead };
  }

  it("accepts valid flat payload", () => {
    const r = call({
      contactPerson: "Test Co",
      email: "test@example.com",
      companyName: "Test Co",
      phone: "9876543210",
      message: "Budgetary estimate. Source: capabilities_estimator",
    });
    assert.equal(r.called, true);
    assert.equal(r.validatedLead.contactPerson, "Test Co");
    assert.ok(r.validatedLead.message.includes("capabilities_estimator"));
  });

  it("rejects missing required fields", () => {
    const r = call({ source: "estimator" });
    assert.equal(r.called, false);
  });

  it("accepts name/company/notes aliases", () => {
    const r = call({
      name: "Alias Co",
      email: "a@b.com",
      company: "Alias Co",
      phone: "1234567890",
      notes: "test",
    });
    assert.equal(r.called, true);
    assert.equal(r.validatedLead.contactPerson, "Alias Co");
  });
});

describe("R5 No careers backend endpoint exists", () => {
  it("no careers route in backend routes/", () => {
    const fs = require("fs");
    const files = fs.readdirSync(__dirname + "/../routes");
    assert.ok(!files.some(f => f.toLowerCase().includes("career")));
  });

  it("no careers middleware", () => {
    const fs = require("fs");
    const files = fs.readdirSync(__dirname + "/../middleware");
    assert.ok(!files.some(f => f.toLowerCase().includes("career")));
  });
});
