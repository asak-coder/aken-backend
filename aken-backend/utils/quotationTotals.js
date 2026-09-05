"use strict";

/**
 * quotationTotals.js
 * ----------------------------------------------------------------------------
 * Pure, side-effect-free quotation money math.
 *
 * Single source of truth for how `subtotal`, `gst`, and `totalAmount` are
 * derived. Nothing in this module touches Express, the database, or any
 * environment variable, so it can be unit-tested in isolation.
 *
 * Invariant guaranteed by this module:
 *     totalAmount === round2(subtotal + gst)
 *
 * `totalAmount` is NEVER taken from caller input. It is derived exclusively
 * from `subtotal` (computed from validated items) and `gst` (validated client
 * value when present, otherwise computed from `gstRate`). This keeps every
 * written row compatible with the Phase 2 database constraint:
 *     quotations_total_integrity CHECK (total_amount = subtotal + gst)
 */

const DEFAULT_GST_RATE = 18; // default 18%
const MIN_GST_RATE = 0; // floor for gstRate
const MAX_GST_RATE = 28; // cap for gstRate (matches existing middleware)
const MAX_ITEM_AMOUNT = 9_999_999_999; // per line-item cap (existing middleware)
const MAX_SUBTOTAL = 9_999_999_999; // subtotal cap (fits NUMERIC(14,2))
const MAX_GST = 9_999_999_999; // gst cap (fits NUMERIC(14,2))
const MONEY_PRECISION = 2; // NUMERIC(14,2) column precision

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Number(n.toFixed(MONEY_PRECISION));
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === "";
}

/**
 * Resolve a validated GST rate.
 * - missing/invalid -> DEFAULT_GST_RATE (18)
 * - otherwise clamped into [MIN_GST_RATE, MAX_GST_RATE]
 */
function resolveGstRate(rawGstRate) {
  if (isEmptyValue(rawGstRate)) {
    return DEFAULT_GST_RATE;
  }

  const n = Number(rawGstRate);
  if (!Number.isFinite(n)) {
    return DEFAULT_GST_RATE;
  }

  return Math.min(MAX_GST_RATE, Math.max(MIN_GST_RATE, n));
}

/**
 * Resolve the GST amount.
 * - a valid (finite, >= 0) client-supplied GST is honored and capped
 * - otherwise the GST is computed from `subtotal` and `gstRate`
 */
function resolveGstAmount(rawGst, subtotal, gstRate) {
  const computedGst = roundMoney((subtotal * gstRate) / 100);

  if (isEmptyValue(rawGst)) {
    return computedGst;
  }

  const n = Number(rawGst);
  if (!Number.isFinite(n) || n < 0) {
    return computedGst;
  }

  return Math.min(MAX_GST, roundMoney(n));
}

/**
 * Compute the subtotal from already-validated line items.
 * Items must be sanitized objects exposing a finite `amount` (the middleware
 * guarantees this before calling here). Capped to MAX_SUBTOTAL.
 */
function computeSubtotal(items) {
  const raw = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const amount = Number(item && item.amount);
    return sum + (Number.isFinite(amount) && amount >= 0 ? amount : 0);
  }, 0);

  return Math.min(MAX_SUBTOTAL, roundMoney(raw));
}

/**
 * Derive { subtotal, gstRate, gst, totalAmount } for a quotation.
 *
 * @param {object} input
 * @param {Array<{amount:number}>} [input.items] sanitized line items
 * @param {*} [input.gstRate] validated-or-defaulted GST rate
 * @param {*} [input.gst] validated-or-ignored client GST (honored if valid)
 * @returns {{subtotal:number, gstRate:number, gst:number, totalAmount:number}}
 *
 * NOTE: The caller may not influence `totalAmount` in any way. Passing a
 * `totalAmount` key here is a no-op by design — it is never read.
 */
function computeQuotationTotals({ items = [], gstRate = null, gst = null } = {}) {
  const subtotal = computeSubtotal(items);
  const normalizedGstRate = resolveGstRate(gstRate);
  const gstAmount = resolveGstAmount(gst, subtotal, normalizedGstRate);
  const totalAmount = roundMoney(subtotal + gstAmount);

  return {
    subtotal,
    gstRate: normalizedGstRate,
    gst: gstAmount,
    totalAmount,
  };
}

module.exports = {
  computeQuotationTotals,
  computeSubtotal,
  resolveGstRate,
  resolveGstAmount,
  roundMoney,
  DEFAULT_GST_RATE,
  MIN_GST_RATE,
  MAX_GST_RATE,
  MAX_ITEM_AMOUNT,
  MAX_SUBTOTAL,
  MAX_GST,
  MONEY_PRECISION,
};
