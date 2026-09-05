"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeQuotationTotals,
  computeSubtotal,
  resolveGstRate,
  resolveGstAmount,
  roundMoney,
  DEFAULT_GST_RATE,
  MAX_GST_RATE,
  MAX_SUBTOTAL,
  MAX_GST,
} = require("../utils/quotationTotals");

// ---------------------------------------------------------------------------
// computeQuotationTotals — core invariant
// ---------------------------------------------------------------------------

test("totalAmount always equals subtotal + gst (no client totalAmount)", () => {
  const items = [
    { amount: 100 },
    { amount: 250.5 },
    { amount: 49.5 },
  ];

  const totals = computeQuotationTotals({ items, gstRate: 18 });

  assert.equal(totals.subtotal, 400);
  assert.equal(totals.gst, 72); // 400 * 0.18
  assert.equal(totals.totalAmount, 472);
  assert.equal(totals.totalAmount, roundMoney(totals.subtotal + totals.gst));
});

test("client-supplied totalAmount is ignored (no-op by design)", () => {
  const items = [{ amount: 1000 }];

  const withoutTotal = computeQuotationTotals({ items, gstRate: 18 });
  const withForgedTotal = computeQuotationTotals({
    items,
    gstRate: 18,
    totalAmount: 999999, // must NEVER influence the result
  });

  assert.deepEqual(withForgedTotal, withoutTotal);
  assert.equal(withForgedTotal.totalAmount, 1180);
});

test("defaults to 18% GST when gstRate is missing or invalid", () => {
  const items = [{ amount: 1000 }];

  const totals = computeQuotationTotals({ items });
  assert.equal(totals.gstRate, DEFAULT_GST_RATE);
  assert.equal(totals.gst, 180);
  assert.equal(totals.totalAmount, 1180);
});

// ---------------------------------------------------------------------------
// resolveGstRate
// ---------------------------------------------------------------------------

test("resolveGstRate clamps into [0, 28]", () => {
  assert.equal(resolveGstRate(12), 12);
  assert.equal(resolveGstRate(-5), 0);
  assert.equal(resolveGstRate(99), MAX_GST_RATE);
  assert.equal(resolveGstRate(0), 0);
  assert.equal(resolveGstRate(28), 28);
});

test("resolveGstRate falls back to default for non-numeric input", () => {
  assert.equal(resolveGstRate(null), DEFAULT_GST_RATE);
  assert.equal(resolveGstRate(undefined), DEFAULT_GST_RATE);
  assert.equal(resolveGstRate(""), DEFAULT_GST_RATE);
  assert.equal(resolveGstRate("abc"), DEFAULT_GST_RATE);
  assert.equal(resolveGstRate(NaN), DEFAULT_GST_RATE);
});

// ---------------------------------------------------------------------------
// resolveGstAmount / gst validation
// ---------------------------------------------------------------------------

test("client-supplied gst is honored when valid", () => {
  const subtotal = 1000;
  const gstRate = 18;
  const gst = 100; // deliberately different from 180

  const totals = computeQuotationTotals({ items: [{ amount: subtotal }], gstRate, gst });
  assert.equal(totals.gst, 100);
  assert.equal(totals.totalAmount, 1100);
});

test("client-supplied gst is ignored when negative or invalid (falls back to computed)", () => {
  const items = [{ amount: 1000 }];

  const expected = computeQuotationTotals({ items, gstRate: 18 });
  const negative = computeQuotationTotals({ items, gstRate: 18, gst: -5 });
  const garbage = computeQuotationTotals({ items, gstRate: 18, gst: "abc" });
  const nanGst = computeQuotationTotals({ items, gstRate: 18, gst: NaN });

  assert.equal(negative.gst, expected.gst);
  assert.equal(garbage.gst, expected.gst);
  assert.equal(nanGst.gst, expected.gst);
  assert.equal(negative.totalAmount, expected.totalAmount);
});

test("gst is capped at MAX_GST", () => {
  const totals = computeQuotationTotals({
    items: [{ amount: 1000 }],
    gstRate: 18,
    gst: MAX_GST + 50,
  });

  assert.equal(totals.gst, MAX_GST);
});

// ---------------------------------------------------------------------------
// computeSubtotal
// ---------------------------------------------------------------------------

test("computeSubtotal sums item amounts and rounds to 2 decimals", () => {
  assert.equal(computeSubtotal([{ amount: 10.005 }, { amount: 5 }]), 15.01);
  assert.equal(computeSubtotal([]), 0);
  assert.equal(computeSubtotal(null), 0);
  assert.equal(computeSubtotal([{ amount: "40" }, { amount: null }]), 40);
});

test("computeSubtotal ignores invalid/negative amounts and caps at MAX_SUBTOTAL", () => {
  assert.equal(computeSubtotal([{ amount: "bad" }, { amount: -10 }, { amount: 5 }]), 5);
  assert.equal(computeSubtotal([{ amount: MAX_SUBTOTAL }, { amount: 100 }]), MAX_SUBTOTAL);
});

// ---------------------------------------------------------------------------
// rounding
// ---------------------------------------------------------------------------

test("roundMoney rounds half-up to 2 decimals and is NaN-safe", () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney(10.004), 10);
  assert.equal(roundMoney("12.345"), 12.35);
  assert.equal(roundMoney(NaN), 0);
  assert.equal(roundMoney(undefined), 0);
});

test("totalAmount stays consistent for fractional GST rates", () => {
  // 1 item @ 123.45, GST rate 12.5 -> subtotal 123.45, gst 15.43, total 138.88
  const totals = computeQuotationTotals({
    items: [{ amount: 123.45 }],
    gstRate: 12.5,
  });

  assert.equal(totals.subtotal, 123.45);
  assert.equal(totals.gst, 15.43);
  assert.equal(totals.totalAmount, 138.88);
  assert.equal(totals.totalAmount, roundMoney(totals.subtotal + totals.gst));
});
