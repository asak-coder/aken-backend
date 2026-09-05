# F1 — Quotation `totalAmount` Server-Side Calculation

**Date:** 2026-08-07
**Severity:** HIGH (blocks Phase 2 database constraint)
**Constraint targeted:** `quotations_total_integrity CHECK (total_amount = subtotal + gst)`
**Scope:** Backend only. No database schema changes. No API contract changes. No frontend changes.

---

## 1. Problem

The quotation creation flow (`POST /api/quotations`) accepted a client-supplied
`totalAmount` and, when present, stored it verbatim (capped at 9,999,999,999):

```js
// old quotationValidation.js
const finalTotal =
  totalAmount !== null && totalAmount >= 0
    ? Math.min(totalAmount, 9_999_999_999) // client trusted!
    : computedTotal;
```

A client could send `totalAmount` that differs from `subtotal + gst`. Phase 2 adds:

```sql
alter table public.quotations
  add constraint quotations_total_integrity check (total_amount = subtotal + gst);
```

After that constraint, any such request would fail with a PostgreSQL CHECK
violation (500) even though the request was otherwise valid.

## 2. Fix

`totalAmount` is now **never trusted from client input**. It is computed
exclusively on the server from validated line items (`subtotal`) and the
validated GST (`gst`). `subtotal` and `gst` remain validated as before. The
invariant `totalAmount = subtotal + gst` is enforced in **two layers**:

1. **Validation layer** — `quotationValidation.js` strips/recomputes totals on
   every create request.
2. **Persistence layer** — `models/Quotation.js` re-derives `totalAmount` from
   the `subtotal`/`gst` being written immediately before every INSERT/UPDATE,
   so no future or alternate write path can persist a violating row.

Both layers share the same pure math module, `utils/quotationTotals.js`, which
is the single source of truth for the money calculations.

## 3. Files modified (complete list)

| File | Change |
|---|---|
| `aken-backend/utils/quotationTotals.js` | **NEW.** Pure, side-effect-free module exporting `computeQuotationTotals`, `computeSubtotal`, `resolveGstRate`, `resolveGstAmount`, `roundMoney`, and domain constants (`DEFAULT_GST_RATE = 18`, `MIN_GST_RATE = 0`, `MAX_GST_RATE = 28`, `MAX_ITEM_AMOUNT`, `MAX_SUBTOTAL`, `MAX_GST`, `MONEY_PRECISION = 2`). Guarantees `totalAmount === round2(subtotal + gst)`. `totalAmount` is never read from caller input. |
| `aken-backend/middleware/quotationValidation.js` | **MODIFIED.** Removed the client `totalAmount` override (`finalTotal`). Totals now derived exclusively via `computeQuotationTotals`. Item validation, string-field validation, `leadId` validation, sanitization, and `req.body` shape are unchanged. `totalAmount` is always overwritten with the server-computed value. |
| `aken-backend/models/Quotation.js` | **MODIFIED.** Added `beforeSave` hook `enforceTotalIntegrity` which recomputes `subtotal`, `gst`, and `totalAmount` at the persistence boundary before every INSERT/UPDATE (the repository calls `beforeSave(doc)` inside `saveDocument`). |
| `aken-backend/package.json` | **MODIFIED.** Added `"test": "node --test tests/"` script. No dependencies added. |
| `aken-backend/tests/quotationTotals.test.js` | **NEW.** 12 unit tests for the totals module (invariant, client-total no-op, GST rate/amount validation, caps, rounding, fractional rates). |
| `aken-backend/tests/quotationValidation.test.js` | **NEW.** 14 validation tests covering forged `totalAmount`, derived totals, honored/ignored client `gst`, item validation regressions, string-field regressions, and body-shape preservation. |
| `F1_QUOTATION_TOTAL_INTEGRITY.md` | **NEW.** This document. |

## 4. Files audited and intentionally NOT modified

Every other location that accepts, validates, calculates, or stores these fields
was audited. No change was needed because they are read-only consumers, or
already compute from stored data:

| File | Role | Why unchanged |
|---|---|---|
| `aken-backend/routes/quotationRoutes.js` | `POST /` persists `req.body` after validation | Persists the sanitized body produced by `quotationValidation`; no independent money math. `POST /:id/convert` only *reads* `quotation.totalAmount` into `projectValue`. |
| `aken-backend/utils/generateQuotationPDF.js` | Renders `subtotal`, `gst`, `totalAmount` | Read-only display of stored values. |
| `aken-backend/routes/exportRoutes.js` | CSV export | Read-only (`quotation.totalAmount`). |
| `aken-backend/routes/revenueRoutes.js` | Analytics aggregates | Read-only (`$totalAmount`), reads stored amounts. |
| `aken-backend/routes/projectRoutes.js` | Margin analytics | Reads `quotation.totalAmount` (via populate) and `projectValue`; no quotation writes. |
| `aken-backend/models/createRepository.js` | Generic repository | Unchanged; its `beforeSave` hook mechanism powers the new guard in `Quotation.js`. |
| `aken-frontend/src/app/admin/quotations/page.tsx` | Admin UI | Only reads `quotation.totalAmount`; no write path. |
| `supabase/SCHEMA.sql`, `supabase/AUDIT_FIXES.sql` | Database | **Not modified per task constraint.** The Phase 2 constraint will now be satisfied by every write. |

Note: the only quotation **write** paths in the codebase are
`quotationRoutes.js POST /` (validated) and `Quotation.create` /
`Quotation.findByIdAndUpdate` / `save()` (now guarded by `beforeSave`).
The lead-to-client lookup `GET /api/leads/client/:quotationNumber` is read-only.

## 5. Behaviour changes (intentional)

- A client-supplied `totalAmount` that disagrees with `subtotal + gst` is
  **silently replaced** with the server-computed value (previously stored).
  The request still succeeds (201). This matches option 1 of finding F1 in
  `SQL_VALIDATION_PLAN.md`.
- A client-supplied `totalAmount` is **never echoed back**; the response
  `data.totalAmount` is always the server-computed value.
- `subtotal` and `gst` validation semantics are unchanged:
  - `gst` is honored when finite and `>= 0`, otherwise computed from `gstRate`.
  - `gstRate` defaults to 18 and is clamped to `[0, 28]`.

Nothing else changed: error codes, status codes, response envelope
(`{ success, data, requestId }`), and all request field names are identical.

## 6. Why the fix is backward compatible

1. **HTTP contract unchanged.** The request may still include `totalAmount`,
   `subtotal`, `gst`, `gstRate` — all accepted and ignored/overridden as
   appropriate. The response still returns `totalAmount`, `subtotal`, `gst`,
   `gstRate`, and `items` with the same camelCase names and types.
2. **Existing frontend continues to work unmodified.** `admin/quotations/page.tsx`
   only renders `quotation.totalAmount` from list/read responses. It never
   submits a quotation (there is no quotation *creation* form in the frontend).
   Clients that do create quotations and send `totalAmount` (e.g. API tooling)
   keep receiving 201 — the value is corrected server-side rather than rejected.
3. **Write semantics preserved for well-formed clients.** Any client whose
   `totalAmount` already matched `subtotal + gst` sees identical stored and
   returned values.
4. **Validation of `subtotal`/`gst` unchanged.** `subtotal` is always computed
   from validated items; a client-supplied `subtotal` was already overwritten
   before this change and still is. `gst`/`gstRate` handling is byte-for-byte
   the same logic, moved into the shared module.
5. **No schema or API changes.** No migration, no new required fields, no
   removed fields. The Phase 2 `quotations_total_integrity` constraint can now
   be applied without breaking valid API traffic.
6. **Defense-in-depth without behavioural risk.** The `beforeSave` guard in
   `Quotation.js` recomputes totals only from values already normalized by the
   validation layer, so it is a no-op for validated creates and only corrects
   any hypothetical non-validated write path.

## 7. Tests

Run from `aken-backend/`:

```bash
npm test
```

or from the repo root:

```bash
node --test aken-backend/tests/
```

Current result: **26/26 passing** (12 unit + 14 validation).

## 8. Rollout note

This fix must ship in the same deployment window as Phase 2 (the
`quotations_total_integrity` constraint). Historical rows already violating the
constraint must be repaired in Phase 3 (`update ... set total_amount =
subtotal + gst where abs(total_amount - (subtotal + gst)) > 0.01`) before the
constraint is added — this code change does not rewrite existing rows.
