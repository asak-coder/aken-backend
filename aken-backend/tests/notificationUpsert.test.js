"use strict";

/**
 * notificationUpsert.test.js
 * ----------------------------------------------------------------------------
 * B2: notification persistence must be an atomic UPSERT, not SELECT -> INSERT.
 *
 * The old repository path for lead_email_notifications /
 * lead_whatsapp_notifications was:
 *   SELECT row (fetchSubRow) -> row missing -> INSERT
 * Two concurrent workers could both observe "no row", both INSERT, and the
 * loser surfaced SQLSTATE 23505 as HTTP 500.
 *
 * The fix routes every notification write through a server-side
 * INSERT ... ON CONFLICT (lead_id) DO UPDATE function (upsertRpc). The fake
 * Supabase client below runs each RPC as a SYNCHRONOUS mutation of a shared
 * map — the exact serialization point PostgreSQL provides via row locking —
 * so the concurrency tests are deterministic: N concurrent upserts always
 * yield exactly one row and a merged counter, never an exception.
 *
 * Coverage:
 *   1. $inc via updateOne -> atomic RPC args (no SELECT/INSERT on the table)
 *   2. Concurrent email retries  -> one row, attemptCount === N, no error
 *   3. Concurrent WhatsApp retries -> one row, attemptCount === N, no error
 *   4. Worker + retry overlap    -> one row, counters merge, timestamps keep
 *      the winning writer's value (never null when a writer set them)
 *   5. save() 1:1 sub-object path -> same RPC, increments untouched
 *   6. Direct $set of attempt_count is rejected (DB_INCREMENT_UNSUPPORTED)
 *   7. Non-RPC sub-tables still use the legacy path (compat guard)
 *   8. HTTP retry endpoints: success 200, missing-lead 404, worker failure 500
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long!!";

const supabaseClient = require("../utils/supabaseClient");
const { createRepository } = require("../models/createRepository");
const Lead = require("../models/Lead");

// ---------------------------------------------------------------------------
// Fake Supabase client — synchronous atomic RPC upsert
// ---------------------------------------------------------------------------

const EMAIL_TABLE = "lead_email_notifications";
const WHATSAPP_TABLE = "lead_whatsapp_notifications";

class FakeQueryBuilder {
  constructor(fake, table) {
    this.fake = fake;
    this.table = table;
    this.filters = [];
    this.columnSelect = null;
    this.limitN = null;
    this.orderSpec = null;
  }

  select(columns) {
    this.columnSelect = columns;
    return this;
  }

  eq(column, value) {
    if (this.pendingUpdate) {
      return this.executeUpdate(column, value);
    }
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  is(column, value) {
    this.filters.push({ type: "is", column, value });
    return this;
  }

  not(column, op, value) {
    this.filters.push({ type: "not", column, op, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  ilike(column, value) {
    this.filters.push({ type: "ilike", column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: "lt", column, value });
    return this;
  }

  order(column, options) {
    this.orderSpec = { column, options };
    return this;
  }

  limit(value) {
    this.limitN = value;
    return this;
  }

  range(from, to) {
    this.rangeSpec = { from, to };
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  matches(row) {
    return this.filters.every((filter) => {
      const value = row[filter.column];
      if (filter.type === "eq") return value === filter.value;
      if (filter.type === "in") return filter.values.includes(value);
      if (filter.type === "is") {
        return filter.value === "null" ? value === null : value === filter.value;
      }
      if (filter.type === "neq") return value !== filter.value;
      if (filter.type === "not") return value !== filter.value;
      if (filter.type === "gte") return value >= filter.value;
      if (filter.type === "lte") return value <= filter.value;
      if (filter.type === "gt") return value > filter.value;
      if (filter.type === "lt") return value < filter.value;
      if (filter.type === "ilike") {
        return String(value || "").toLowerCase().includes(String(filter.value).toLowerCase());
      }
      return true;
    });
  }

  async execute() {
    const rows = this.fake.rowsFor(this.table);

    let result = [...rows.values()].filter((row) => this.matches(row));

    if (this.orderSpec) {
      const { column, options } = this.orderSpec;
      result.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        if (aVal === bVal) return 0;
        const cmp = aVal < bVal ? -1 : 1;
        return options?.ascending === false ? -cmp : cmp;
      });
    }

    if (this.limitN !== null) {
      result = result.slice(0, this.limitN);
    }
    if (this.rangeSpec) {
      result = result.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    }

    this.fake.recordCall({ type: "select", table: this.table, filters: this.filters });

    if (this.singleMode) {
      return { data: result[0] || null, error: null };
    }
    return { data: result, error: null };
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  update(patch) {
    this.pendingUpdate = patch;
    return this;
  }

  async executeUpdate(column, value) {
    this.filters.push({ type: "eq", column, value });
    this.fake.recordCall({
      type: "update",
      table: this.table,
      patch: this.pendingUpdate,
      filters: this.filters,
    });
    for (const row of this.fake.rowsFor(this.table).values()) {
      if (this.matches(row)) {
        Object.assign(row, this.pendingUpdate, { updated_at: this.fake.nowIso() });
      }
    }
    return { data: null, error: null };
  }

  async insert(payload) {
    this.fake.recordCall({ type: "insert", table: this.table, payload });
    const rows = this.fake.rowsFor(this.table);
    const row = { ...payload };
    if (!row.id) row.id = this.fake.nextId();
    if (!row.created_at) row.created_at = this.fake.nowIso();
    rows.set(String(row.id), row);
    return { data: [row], error: null };
  }
}

class FakeSupabase {
  constructor() {
    this.tables = {
      leads: new Map(),
      [EMAIL_TABLE]: new Map(),
      [WHATSAPP_TABLE]: new Map(),
      lead_notes: new Map(),
    };
    this.calls = [];
    this.idCounter = 0;
    this.now = new Date("2026-08-08T12:00:00.000Z");
  }

  nowIso() {
    this.now = new Date(this.now.getTime() + 1);
    return this.now.toISOString();
  }

  nextId() {
    this.idCounter += 1;
    return `00000000-0000-4000-8000-${String(this.idCounter).padStart(12, "0")}`;
  }

  rowsFor(table) {
    return this.tables[table] || (this.tables[table] = new Map());
  }

  recordCall(call) {
    this.calls.push(call);
  }

  // Implements the exact SQL semantics of upsert_lead_*_notification: a
  // synchronous mutation = PostgreSQL row-lock serialization, so concurrent
  // callers queue on the same key and their deltas merge with no exception.
  makeUpsertRpc(table, incrementArgName = "p_attempt_count_delta") {
    return (args) => {
      const leadId = String(args.p_lead_id);
      const rows = this.rowsFor(table);
      const current = rows.get(leadId) || { attempt_count: 0 };

      const next = { ...current };
      for (const [key, value] of Object.entries(args)) {
        if (key.startsWith("p_has_")) {
          const column = key.slice("p_has_".length);
          if (value === true) {
            const valueKey = `p_${column}`;
            next[column] = args[valueKey] === undefined ? null : args[valueKey];
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(args, incrementArgName)) {
        const column = incrementArgName.slice(2, -"_delta".length);
        const delta = Number(args[incrementArgName]) || 0;
        next[column] = Number(next[column] || 0) + Math.max(delta, 0);
      }
      next.updated_at = this.nowIso();
      rows.set(leadId, next);
      this.recordCall({ type: "rpc", args });
      return 1;
    };
  }

  setEmailUpsert() {
    this.upserts = {
      upsert_lead_email_notification: this.makeUpsertRpc(EMAIL_TABLE, "p_attempt_count_delta"),
      upsert_lead_whatsapp_notification: this.makeUpsertRpc(WHATSAPP_TABLE, "p_attempt_count_delta"),
    };
  }

  rpc(name, args) {
    const fn = this.upserts[name];
    if (!fn) {
      return Promise.resolve({ data: null, error: { code: "PGRST202", message: `RPC ${name} not found` } });
    }
    return Promise.resolve({ data: fn(args), error: null });
  }

  from(table) {
    return new FakeQueryBuilder(this, table);
  }
}

function buildFake(seedLead) {
  const fake = new FakeSupabase();
  fake.setEmailUpsert();
  if (seedLead) {
    fake.tables.leads.set(seedLead.id, { ...seedLead, created_at: fake.nowIso(), updated_at: fake.nowIso() });
  }
  mock.method(supabaseClient, "getSupabaseClient", () => fake);
  return fake;
}

function makeLeadRow(id) {
  return {
    id,
    contact_person: "Test User",
    email: "test@example.com",
    company_name: "Test Co",
    phone: "919876543210",
    message: "Hello",
    status: "New",
  };
}

// ---------------------------------------------------------------------------
// 1. $inc via updateOne -> RPC args, no SELECT/INSERT on the table
// ---------------------------------------------------------------------------

test("updateOne with $inc/$set on notifications routes through the atomic RPC (no SELECT, no INSERT)", async (t) => {
  const leadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const fake = buildFake(makeLeadRow(leadId));
  t.after(() => mock.restoreAll());

  const attemptAt = new Date("2026-08-08T10:00:00.000Z");
  await Lead.updateOne(
    { _id: leadId },
    {
      $inc: { "emailNotifications.attemptCount": 1 },
      $set: { "emailNotifications.lastAttemptAt": attemptAt },
    },
  );

  const rpcCalls = fake.calls.filter((call) => call.type === "rpc");
  assert.equal(rpcCalls.length, 1, "exactly one RPC write");
  assert.equal(fake.calls.filter((call) => call.type === "insert").length, 0, "no table INSERT");
  assert.equal(
    fake.calls.filter((call) => call.type === "select" && call.table === EMAIL_TABLE).length,
    0,
    "no SELECT on the notification table",
  );

  const args = rpcCalls[0].args;
  assert.equal(args.p_lead_id, leadId);
  assert.equal(args.p_attempt_count_delta, 1);
  assert.equal(args.p_has_last_attempt_at, true);
  assert.equal(args.p_last_attempt_at.toISOString(), attemptAt.toISOString());
  assert.equal(args.p_has_admin_notified_at, false, "unset columns are preserved");

  const rows = fake.rowsFor(EMAIL_TABLE);
  assert.equal(rows.size, 1, "exactly one row");
  const row = rows.get(leadId);
  assert.equal(row.attempt_count, 1);
  assert.equal(row.last_attempt_at, attemptAt);
});

// ---------------------------------------------------------------------------
// 2. Concurrent email retries
// ---------------------------------------------------------------------------

test("concurrent email retries: one row, attemptCount === N, no 23505, no throw", async (t) => {
  const leadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const fake = buildFake(makeLeadRow(leadId));
  t.after(() => mock.restoreAll());

  const CONCURRENCY = 12;
  const attempts = Array.from({ length: CONCURRENCY }, () =>
    Lead.updateOne(
      { _id: leadId },
      {
        $inc: { "emailNotifications.attemptCount": 1 },
        $set: { "emailNotifications.lastAttemptAt": new Date() },
      },
    ),
  );

  await Promise.all(attempts); // must NOT throw

  const rows = fake.rowsFor(EMAIL_TABLE);
  assert.equal(rows.size, 1, "exactly one row for the lead");
  const row = rows.get(leadId);
  assert.equal(row.attempt_count, CONCURRENCY, "every retry increments the shared counter");
  assert.ok(row.last_attempt_at, "timestamp was written");
  assert.equal(fake.calls.filter((call) => call.type === "insert").length, 0, "no INSERT at all");
  assert.equal(
    fake.calls.filter((call) => call.type === "rpc").length,
    CONCURRENCY,
    "every retry is one atomic write",
  );
});

// ---------------------------------------------------------------------------
// 3. Concurrent WhatsApp retries
// ---------------------------------------------------------------------------

test("concurrent WhatsApp retries: one row, attemptCount === N, no 23505", async (t) => {
  const leadId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const fake = buildFake(makeLeadRow(leadId));
  t.after(() => mock.restoreAll());

  const CONCURRENCY = 10;
  const attempts = Array.from({ length: CONCURRENCY }, () =>
    Lead.updateOne(
      { _id: leadId },
      {
        $inc: { "whatsappNotifications.attemptCount": 1 },
        $set: { "whatsappNotifications.lastAttemptAt": new Date() },
      },
    ),
  );

  await Promise.all(attempts);

  const rows = fake.rowsFor(WHATSAPP_TABLE);
  assert.equal(rows.size, 1);
  const row = rows.get(leadId);
  assert.equal(row.attempt_count, CONCURRENCY);
  assert.equal(fake.calls.filter((call) => call.type === "insert").length, 0);
});

// ---------------------------------------------------------------------------
// 4. Worker + retry endpoint overlap
// ---------------------------------------------------------------------------

test("worker + retry overlap: counters merge, timestamps keep a written value, single row", async (t) => {
  const leadId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const fake = buildFake(makeLeadRow(leadId));
  t.after(() => mock.restoreAll());

  const workerStamp = new Date("2026-08-08T08:00:00.000Z");
  const retryStamp = new Date("2026-08-08T09:00:00.000Z");

  const worker = Lead.updateOne(
    { _id: leadId },
    {
      $inc: { "emailNotifications.attemptCount": 1 },
      $set: {
        "emailNotifications.lastAttemptAt": workerStamp,
        "emailNotifications.adminNotifiedAt": workerStamp,
      },
    },
  );

  const retry = Lead.updateOne(
    { _id: leadId },
    {
      $inc: { "emailNotifications.attemptCount": 1 },
      $set: { "emailNotifications.lastAttemptAt": retryStamp },
    },
  );

  await Promise.all([worker, retry]);

  const rows = fake.rowsFor(EMAIL_TABLE);
  assert.equal(rows.size, 1, "single row despite overlapping writers");
  const row = rows.get(leadId);
  assert.equal(row.attempt_count, 2, "both increments survive");
  assert.ok(row.last_attempt_at instanceof Date, "lastAttemptAt holds a resolved timestamp");
  assert.ok(
    row.last_attempt_at.getTime() === workerStamp.getTime() ||
      row.last_attempt_at.getTime() === retryStamp.getTime(),
    "lastAttemptAt matches one of the written values (never null)",
  );
  assert.equal(
    row.admin_notified_at.getTime(),
    workerStamp.getTime(),
    "column set by only one writer is preserved",
  );
});

// ---------------------------------------------------------------------------
// 5. save() 1:1 sub-object path
// ---------------------------------------------------------------------------

test("save() with a notification sub-object upserts atomically and leaves counters untouched", async (t) => {
  const leadId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const fake = buildFake(makeLeadRow(leadId));
  fake.rowsFor(EMAIL_TABLE).set(leadId, { lead_id: leadId, attempt_count: 3 });
  t.after(() => mock.restoreAll());

  const lead = await Lead.findById(leadId);
  lead.emailNotifications = { lastError: "boom" };
  await lead.save();

  const rows = fake.rowsFor(EMAIL_TABLE);
  assert.equal(rows.size, 1, "no duplicate row");
  const row = rows.get(leadId);
  assert.equal(row.attempt_count, 3, "save() does not reset the retry counter");
  assert.equal(row.last_error, "boom");
  assert.equal(fake.calls.filter((call) => call.type === "insert").length, 0);
});

// ---------------------------------------------------------------------------
// 6. Direct $set of the increment column is rejected
// ---------------------------------------------------------------------------

test("direct $set of attemptCount is rejected with DB_INCREMENT_UNSUPPORTED", async (t) => {
  const leadId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  buildFake(makeLeadRow(leadId));
  t.after(() => mock.restoreAll());

  await assert.rejects(
    Lead.updateOne(
      { _id: leadId },
      { $set: { "emailNotifications.attemptCount": 99 } },
    ),
    (error) => error.code === "DB_INCREMENT_UNSUPPORTED",
  );
});

// ---------------------------------------------------------------------------
// 7. Non-RPC sub-tables keep the legacy SELECT->INSERT/UPDATE path
// ---------------------------------------------------------------------------

test("sub-tables without upsertRpc still use the legacy path (backward compatibility)", async (t) => {
  const fake = buildFake(null);
  t.after(() => mock.restoreAll());

  const LegacyModel = createRepository({
    table: "legacy_parent",
    fieldMap: { id: "_id" },
    subTables: {
      child: {
        table: "legacy_child",
        fkMap: { parent_id: "parentId" },
        rowMap: { value: "value" },
      },
    },
  });

  const parentId = "99999999-9999-4999-8999-999999999999";
  // legacy_child intentionally has no row -> the legacy path INSERTs.

  await LegacyModel.updateOne(
    { _id: parentId },
    { $set: { "child.value": "hello" } },
  );

  const inserts = fake.calls.filter((call) => call.type === "insert" && call.table === "legacy_child");
  assert.equal(inserts.length, 1, "legacy sub-table still inserts");
  assert.equal(inserts[0].payload.parent_id, parentId);
});

// ---------------------------------------------------------------------------
// 8. HTTP retry endpoints
// ---------------------------------------------------------------------------

const express = require("express");

// Stub middleware + worker boundaries BEFORE requiring the router.
const authCookies = require("../utils/authCookies");
const csrf = require("../middleware/csrf");
const rateLimiters = require("../middleware/rateLimiters");

authCookies.getTokenFromRequest = () => "test-session-token";
authCookies.verifySessionToken = () => ({ id: "user-1", name: "Admin", role: "admin" });
csrf.csrfProtection = (req, res, next) => next();
rateLimiters.leadMutationLimiter = (req, res, next) => next();

const leadRoutes = require("../routes/leadRoutes");
const emailUtils = require("../utils/leadEmailNotifications");
const whatsappUtils = require("../utils/leadWhatsAppNotifications");

const RETRY_LEAD_ID = "12345678-1234-4234-8234-123456789012";

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/leads", leadRoutes);
  const server = await new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

test("POST /:id/notifications/retry returns 200 when the worker succeeds", async (t) => {
  const fake = buildFake(makeLeadRow(RETRY_LEAD_ID));
  mock.method(Lead, "exists", async () => ({ id: RETRY_LEAD_ID }));
  mock.method(emailUtils, "sendLeadNotificationEmails", async () => ({ ok: true, errors: [] }));
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/leads/${RETRY_LEAD_ID}/notifications/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.result.ok, true);
});

test("POST /:id/whatsapp/retry returns 200 when the worker succeeds", async (t) => {
  buildFake(makeLeadRow(RETRY_LEAD_ID));
  mock.method(Lead, "exists", async () => ({ id: RETRY_LEAD_ID }));
  mock.method(whatsappUtils, "sendLeadWhatsAppNotifications", async () => ({ ok: true, errors: [] }));
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/leads/${RETRY_LEAD_ID}/whatsapp/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.result.ok, true);
});

test("retry endpoints return 404 LEAD_NOT_FOUND for a missing lead", async (t) => {
  buildFake(null);
  mock.method(Lead, "exists", async () => null);
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/leads/${RETRY_LEAD_ID}/notifications/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "LEAD_NOT_FOUND");
});

test("retry endpoints keep the 500 contract for genuine (non-23505) worker failures", async (t) => {
  buildFake(makeLeadRow(RETRY_LEAD_ID));
  mock.method(Lead, "exists", async () => ({ id: RETRY_LEAD_ID }));
  mock.method(emailUtils, "sendLeadNotificationEmails", async () => {
    throw Object.assign(new Error("resend quota exceeded"), { code: "RATE_LIMITED" });
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/leads/${RETRY_LEAD_ID}/notifications/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error.code, "LEAD_EMAIL_RETRY_FAILED");
});

// ---------------------------------------------------------------------------
// 9. End-to-end worker: concurrent sendLeadNotificationEmails runs
//    against the fake DB — single row, merged counter, no 23505
// ---------------------------------------------------------------------------

test("concurrent sendLeadNotificationEmails runs: single row, attemptCount === N, no throw", async (t) => {
  const leadId = "abababab-abab-4bab-8bab-abababababab";
  const fake = buildFake({ ...makeLeadRow(leadId), email: "client@example.com" });
  t.after(() => mock.restoreAll());

  process.env.LEAD_ALERT_EMAILS = "admin@example.com";
  const sendEmail = require("../utils/sendEmail");
  mock.method(sendEmail, "isEmailConfigured", () => true);
  mock.method(sendEmail, "sendEmail", async () => ({ provider: "resend", id: "mocked" }));

  const CONCURRENCY = 8;
  const { sendLeadNotificationEmails } = require("../utils/leadEmailNotifications");
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => sendLeadNotificationEmails(leadId)),
  );

  for (const result of results) {
    assert.equal(result.ok, true, "no worker run throws or reports persistence failure");
  }

  const rows = fake.rowsFor(EMAIL_TABLE);
  assert.equal(rows.size, 1, "exactly one notification row for the lead");
  assert.equal(
    rows.get(leadId).attempt_count,
    CONCURRENCY,
    "every concurrent worker run incremented the shared counter",
  );
  assert.equal(
    fake.calls.filter((call) => call.type === "insert").length,
    0,
    "no table INSERT anywhere in the worker path",
  );
});
