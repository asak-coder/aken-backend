"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { quotationValidation } = require("../middleware/quotationValidation");

// ---------------------------------------------------------------------------
// Harness helpers
// ---------------------------------------------------------------------------

const VALID_ITEM = { description: "Steel Fabrication", quantity: 2, rate: 500 };

function runMiddleware(body) {
  const req = { body };
  let nextCalled = false;

  const res = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  quotationValidation(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
}

function assertPass(req, res, nextCalled) {
  assert.equal(nextCalled, true, "middleware should call next()");
  assert.equal(res.statusCode, 0, "no error response should be sent");
  return req.body;
}

function assertFails(res, nextCalled, expectedCode) {
  assert.equal(nextCalled, false, "middleware must NOT call next()");
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, expectedCode);
}

// ---------------------------------------------------------------------------
// Core F1 behaviour: client totalAmount is never trusted
// ---------------------------------------------------------------------------

test("client-supplied totalAmount is overwritten with server-computed total", () => {
  const body = {
    quotationNumber: "Q-1",
    clientEmail: "client@example.com",
    leadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    items: [
      { ...VALID_ITEM },
      { description: "Installation", quantity: 1, rate: 1000 },
    ],
    gstRate: 18,
    totalAmount: 1, // attacker/client sends a bogus total
  };

  const { req, res, nextCalled } = runMiddleware(body);
  const sanitized = assertPass(req, res, nextCalled);

  // subtotal = 1000 + 1000 = 2000; gst = 360; total = 2360 — NOT 1
  assert.equal(sanitized.subtotal, 2000);
  assert.equal(sanitized.gst, 360);
  assert.equal(sanitized.totalAmount, 2360);
  assert.equal(sanitized.totalAmount, Number((sanitized.subtotal + sanitized.gst).toFixed(2)));
});

test("totalAmount is always derived: subtotal + gst invariant holds", () => {
  const body = {
    items: [
      { description: "Peb Shed", quantity: 3, rate: 1234.56 },
      { description: "Transport", quantity: 1, rate: 5000 },
    ],
    gstRate: 12,
  };

  const { req, res, nextCalled } = runMiddleware(body);
  const sanitized = assertPass(req, res, nextCalled);

  // item1 amount = 3 * 1234.56 = 3703.68; item2 = 5000; subtotal = 8703.68
  assert.equal(sanitized.items[0].amount, 3703.68);
  assert.equal(sanitized.subtotal, 8703.68);
  assert.equal(sanitized.gst, Number(((8703.68 * 12) / 100).toFixed(2)));
  assert.equal(
    sanitized.totalAmount,
    Number((sanitized.subtotal + sanitized.gst).toFixed(2)),
  );
});

test("valid client-supplied gst is honored; total recalculated from it", () => {
  const body = {
    items: [{ description: "Item A", quantity: 1, rate: 1000 }],
    gstRate: 18,
    gst: 100, // client override
    totalAmount: 9999, // must be ignored
  };

  const { req, res, nextCalled } = runMiddleware(body);
  const sanitized = assertPass(req, res, nextCalled);

  assert.equal(sanitized.subtotal, 1000);
  assert.equal(sanitized.gst, 100);
  assert.equal(sanitized.totalAmount, 1100);
});

test("invalid/negative client gst falls back to computed GST", () => {
  const body = {
    items: [{ description: "Item A", quantity: 1, rate: 1000 }],
    gstRate: 18,
    gst: -50,
  };

  const { req, res, nextCalled } = runMiddleware(body);
  const sanitized = assertPass(req, res, nextCalled);

  assert.equal(sanitized.subtotal, 1000);
  assert.equal(sanitized.gst, 180);
  assert.equal(sanitized.totalAmount, 1180);
});

test("totalAmount is always set even when client omits it", () => {
  const body = {
    items: [{ description: "Item A", quantity: 1, rate: 1000 }],
  };

  const { req, res, nextCalled } = runMiddleware(body);
  const sanitized = assertPass(req, res, nextCalled);

  assert.equal(sanitized.subtotal, 1000);
  assert.equal(sanitized.gstRate, 18); // default GST rate
  assert.equal(sanitized.gst, 180);
  assert.equal(sanitized.totalAmount, 1180);
});

// ---------------------------------------------------------------------------
// Item validation (unchanged behaviour)
// ---------------------------------------------------------------------------

test("rejects missing items", () => {
  const { res, nextCalled } = runMiddleware({});
  assertFails(res, nextCalled, "QUOTATION_ITEMS_REQUIRED");
});

test("rejects invalid item quantity", () => {
  const { res, nextCalled } = runMiddleware({
    items: [{ description: "A", quantity: 0, rate: 100 }],
  });
  assertFails(res, nextCalled, "QUOTATION_ITEM_QUANTITY_INVALID");
});

test("rejects invalid item rate", () => {
  const { res, nextCalled } = runMiddleware({
    items: [{ description: "A", quantity: 1, rate: -5 }],
  });
  assertFails(res, nextCalled, "QUOTATION_ITEM_RATE_INVALID");
});

test("rejects item without description", () => {
  const { res, nextCalled } = runMiddleware({
    items: [{ quantity: 1, rate: 100 }],
  });
  assertFails(res, nextCalled, "QUOTATION_ITEM_DESCRIPTION_INVALID");
});

test("item amount is computed when client omits it", () => {
  const { req, res, nextCalled } = runMiddleware({
    items: [{ description: "A", quantity: 3, rate: 150.5 }],
  });
  const sanitized = assertPass(req, res, nextCalled);
  assert.equal(sanitized.items[0].amount, 451.5);
});

// ---------------------------------------------------------------------------
// String fields (unchanged behaviour)
// ---------------------------------------------------------------------------

test("rejects oversized quotation number", () => {
  const { res, nextCalled } = runMiddleware({
    quotationNumber: "X".repeat(65),
    items: [VALID_ITEM],
  });
  assertFails(res, nextCalled, "QUOTATION_NUMBER_TOO_LONG");
});

test("rejects oversized client email", () => {
  const { res, nextCalled } = runMiddleware({
    clientEmail: `${"a".repeat(119)}@example.com`,
    items: [VALID_ITEM],
  });
  assertFails(res, nextCalled, "QUOTATION_CLIENT_EMAIL_INVALID");
});

test("rejects invalid leadId shape", () => {
  const { res, nextCalled } = runMiddleware({
    leadId: "not-a-valid-id",
    items: [VALID_ITEM],
  });
  assertFails(res, nextCalled, "QUOTATION_LEAD_INVALID");
});

// ---------------------------------------------------------------------------
// Backward compatibility: response/body shape preserved
// ---------------------------------------------------------------------------

test("sanitized body keeps extra client fields untouched", () => {
  const body = {
    items: [VALID_ITEM],
    notes: "rush order",
    clientAddress: "Kolkata",
  };

  const { req, res, nextCalled } = runMiddleware(body);
  const sanitized = assertPass(req, res, nextCalled);

  assert.equal(sanitized.notes, "rush order");
  assert.equal(sanitized.clientAddress, "Kolkata");
  assert.equal(typeof sanitized.items, "object");
  assert.equal(sanitized.items.length, 1);
});
