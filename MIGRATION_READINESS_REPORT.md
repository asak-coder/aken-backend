# A K ENGINEERING — MongoDB → Supabase Data Migration Readiness Report

**Date:** 2026-08-30
**Scope:** Prepare a MongoDB-to-Supabase data migration toolkit and perform an **approved dry-run only**.
**Mode:** READ-ONLY. No MongoDB write, no Supabase write, no DDL, no `.env` modification.

---

## 1. Executive Summary

The application code was migrated from MongoDB to Supabase (commit `174e21e`) **without** moving the
historical data. The Supabase target project `garrlnwamcwnypjrsfji` is healthy and application-compatible,
but all 15 application tables are **empty** (verified live, count = 0 each).

A self-contained, deterministic migration toolkit was built under `scripts/migrate/` and its read-only
steps were executed. **The live MongoDB source could not be reached** because **no MongoDB connection
string exists anywhere in this repository or its runtime environment**:

- `aken-backend/.env` contains **no** `MONGO_URI`, `MONGODB_URI`, or any Mongo config key (verified by a
  masked env probe).
- `PRODUCTION_DATA_SOURCE_DISCOVERY.md` already established that `MONGO_URI` lived **only** in the Render
  dashboard and was never committed, and that no Mongo dump/export exists in the repo or git history.

As a result, the **source inventory is BLOCKED** and no dry-run transformation could be produced. The
migration toolkit and its deterministic mapping are ready; only the Mongo credentials (or a Mongo dump)
are missing. **This is not a code-readiness problem — it is a credentials/data-location problem.**

---

## 2. Production-Readiness Verdict

> ## **BLOCKED BY CONNECTION/CREDENTIALS**

The toolkit is structurally READY FOR APPROVED MIGRATION, but a live run **cannot proceed** until the
MongoDB source is reachable. Once `MONGO_URI` is available (or a Mongo dump is supplied), the toolkit's
`inventory` / `dry-run` / `validate` commands will produce real counts and the verdict can move to
`READY_FOR_APPROVED_MIGRATION` or `BLOCKED_BY_DATA_QUALITY`.

---

## 3. Files Created or Changed

Only new files were added. No existing project file, `.env`, database, or configuration was modified.

| Path | Purpose |
|---|---|
| `scripts/migrate/index.js` | CLI entry point (`inventory` / `dry-run` / `validate` / `execute`) with hard execution guard |
| `scripts/migrate/package.json` | Toolkit metadata; optional `mongodb` driver |
| `scripts/migrate/README.md` | Toolkit documentation + usage |
| `scripts/migrate/lib/env.js` | Safe env loader (never prints credentials) |
| `scripts/migrate/lib/idmap.js` | Deterministic ObjectId→UUID v5 mapping (`IdMap`, `canonicalId`, `uuidv5`) |
| `scripts/migrate/lib/collections.js` | Migration contract: source→target field maps, sub/join tables, refs, required, unique, enum, import order |
| `scripts/migrate/lib/supabase.js` | Read-only Supabase helper (counts + SELECT; wires `ws` for Node 20) |
| `scripts/migrate/lib/mongo.js` | Read-only MongoDB helper (guarded; `secondaryPreferred`, no write exposed) |
| `scripts/migrate/lib/transform.js` | Mongo doc → target row(s) transform (camelCase→snake_case, FKs, embedded→relational) |
| `scripts/migrate/lib/validate.js` | Per-record validation (required / enum / type / reference) |
| `scripts/migrate/lib/reporters.js` | JSON + Markdown report writers (no secrets, no PII) |
| `scripts/migrate/tests/idmap.test.js` | 7 unit tests for the ID mapping |
| `scripts/migrate/tests/transform.test.js` | 4 unit tests for the transform |
| `scripts/migrate/reports/.gitignore` | Ignore generated reports (keeps artifacts out of git) |

---

## 4. Source MongoDB Collection Counts

**BLOCKED — no Mongo connection string present.**

| Collection (expected) | Target Table | Status | Count |
|---|---|---|---|
| users | users | BLOCKED | n/a |
| leads | leads | BLOCKED | n/a |
| activitylogs / activity_logs | activity_logs | BLOCKED | n/a |
| quotations | quotations | BLOCKED | n/a |
| projects | projects | BLOCKED | n/a |
| boqs / boq_entries | boq_entries | BLOCKED | n/a |
| materials | materials | BLOCKED | n/a |
| labourentries / labour_entries | labour_entries | BLOCKED | n/a |
| invoices | invoices | BLOCKED | n/a |
| forecasts | forecasts | BLOCKED | n/a |
| tenders | tenders | BLOCKED | n/a |

The exact collection names in the live Mongo database cannot be confirmed without a connection. The
toolkit supports both the Mongoose-default pluralizations (e.g. `activitylogs`, `labourentries`,
`boqs`) and the snake_case relational names (`activity_logs`, `labour_entries`, `boq_entries`) via
`mapName`.

---

## 5. Proposed Supabase Insert Counts by Table

**UNKNOWN (0 shown)** — no source data could be transformed because MongoDB is unreachable. The dry-run
report is `scripts/migrate/reports/dry_run_*.json` and correctly reports `proposedInserts: []` with the
verdict `BLOCKED_BY_CONNECTION_CREDENTIALS`.

---

## 6. Records That Would Be Rejected, Grouped by Reason

**N/A at this time** — no documents could be read from MongoDB, so no rejection analysis could be run.
The validation rules (required, enum, reference, type) are encoded in `lib/collections.js` and
`lib/validate.js` and will classify rejections as soon as the source is reachable.

---

## 7. Duplicate and Referential-Integrity Findings

**N/A at this time** — no source documents were available. The toolkit will detect:
- **Duplicate primary keys** (two source docs mapping to the same deterministic UUID),
- **Duplicate unique-key candidates** (duplicate `users.email`, `quotations.quotation_number`,
  `forecasts.month`, `invoices.invoice_number`),
- **Orphaned references** (FKs pointing at docs that produce no target row).

---

## 8. Deterministic ID-Mapping Approach

Mongo `ObjectId`s (24-hex) are mapped to **RFC 4122 UUID v5** using a fixed, project-specific namespace:

```
uuid = uuidv5(namespace = 4fa6d9e3-2b1e-4c7b-9a1c-9f7e5d2a6b0c, name = objectIdHex)
```

Properties:
- **Deterministic**: the same ObjectId always yields the same UUID on any machine/run.
- **No persisted state required** for correctness; an `IdMap` can be persisted (id pairs only) for
  reference during a future live run.
- **Referential integrity preserved**: every FK (`ownerId`, `leadId`, `quotationId`, `projectId`,
  `performedBy`) is remapped through the same function.
- **Mixed-format safety**: a value that is already a UUID passes through unchanged; any other value is
  hashed to a stable UUID, so legacy/mixed ids still produce valid, unique target ids.
- **Idempotency**: because PKs are deterministic, a re-run of an approved `execute` cannot create
  duplicate rows (it uses `INSERT ... ON CONFLICT (id) DO NOTHING`).

---

## 9. Required Import Order (derived from `supabase/SCHEMA.sql` FKs)

Confirmed against the actual foreign keys in `supabase/SCHEMA.sql`:

| Order | Table | FK dependency |
|---|---|---|
| 1 | `users` | — |
| 2 | `leads` | `owner_id` → users |
| 3 | `lead_email_notifications` | `lead_id` → leads |
| 4 | `lead_whatsapp_notifications` | `lead_id` → leads |
| 5 | `lead_notes` | `lead_id` → leads |
| 6 | `activity_logs` | `lead_id` → leads; `performed_by` → users |
| 7 | `quotations` | `lead_id` → leads |
| 8 | `quotation_items` | `quotation_id` → quotations |
| 9 | `projects` | `quotation_id` → quotations; `lead_id` → leads |
| 10 | `boq_entries` | `project_id` → projects |
| 11 | `materials` | `project_id` → projects |
| 12 | `labour_entries` | `project_id` → projects |
| 13 | `invoices` | `project_id` → projects |
| 14 | `forecasts` | — |
| 15 | `tenders` | — |

---

## 10. Exact Future Execution Command (NOT RUN)

```bash
node scripts/migrate/index.js execute --execute --confirm AKEN_LIVE_MIGRATION
```

**This command was NOT invoked.** The toolkit's `execute` handler refuses unless BOTH `--execute` and
`--confirm AKEN_LIVE_MIGRATION` are supplied. Verified:

- `node scripts/migrate/index.js execute` → **EXECUTE_REFUSED**
- `node scripts/migrate/index.js execute --execute --confirm WRONG_TOKEN` → **EXECUTE_REFUSED**

---

## 11. Rollback Strategy for a Future Live Migration

1. Take a read-only snapshot of the Supabase tables BEFORE execution (e.g. `pg_dump`).
2. All target PKs are deterministic UUIDs from the source ObjectIds, so a re-run cannot duplicate rows
   (the import uses `INSERT ... ON CONFLICT (id) DO NOTHING`).
3. If a partial run must be undone, DELETE only the inserted rows using the source→target id map
   (written under `scripts/migrate/reports/`).
4. No DDL is touched — the schema is never altered by the migration.

---

## 12. Commands Run (all read-only) and Results

| Command | Result | Output report |
|---|---|---|
| `node scripts/migrate/tests/` (unit tests) | 11/11 pass | — |
| `node scripts/migrate/index.js inventory` | `BLOCKED_BY_CONNECTION_OR_MISSING_SOURCE` | `reports/inventory_*.json` / `.md` |
| `node scripts/migrate/index.js dry-run` | `BLOCKED_BY_CONNECTION_CREDENTIALS` | `reports/dry_run_*.json` / `.md` |
| `node scripts/migrate/index.js validate` | `BLOCKED_BY_CONNECTION_CREDENTIALS` | `reports/validate_*.json` / `.md` |
| `node scripts/migrate/index.js execute` | `EXECUTE_REFUSED` | `reports/execute_refused_*.json` / `.md` |
| `node scripts/migrate/index.js execute --execute --confirm WRONG_TOKEN` | `EXECUTE_REFUSED` | `reports/execute_refused_*.json` / `.md` |

---

## 13. Live Supabase Target Inventory (confirmed read-only)

All 15 tables exist in project `garrlnwamcwnypjrsfji` and contain **0 rows**:

`users, leads, lead_email_notifications, lead_whatsapp_notifications, lead_notes, activity_logs,
quotations, quotation_items, projects, boq_entries, materials, labour_entries, invoices, forecasts,
tenders` — all `count = 0`, all `exists = true`.

---

## 14. Safety Confirmation

| Check | Result |
|---|---|
| MongoDB writes performed | **NO** |
| Supabase writes performed | **NO** |
| DDL changes performed | **NO** |
| `.env` modified | **NO** |
| Credentials exposed | **NO** |
| Live migration executed | **NO** |

---

## 15. Unblocking Next Steps (read-only, no writes)

Only one of the following is required to move from `BLOCKED BY CONNECTION/CREDENTIALS`:

1. Provide `MONGO_URI` (or `MONGODB_URI`) in `aken-backend/.env` pointing at the historical Atlas
   cluster (read-only user or `readPreference=secondary`), OR
2. Provide a MongoDB dump/export (BSON/JSON) so the toolkit can read from a local file instead of a
   live cluster.

Then re-run, in order (all read-only):

```bash
node scripts/migrate/index.js inventory
node scripts/migrate/index.js dry-run
node scripts/migrate/index.js validate
```

The final verdict will then be `READY_FOR_APPROVED_MIGRATION` or `BLOCKED_BY_DATA_QUALITY`.
