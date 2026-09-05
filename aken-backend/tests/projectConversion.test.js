"use strict";

/**
 * projectConversion.test.js
 * ----------------------------------------------------------------------------
 * Concurrency tests for the F3 fix: SQLSTATE 23505 during Lead/Quotation ->
 * Project conversion must resolve to the established business response
 * `{ alreadyExists: true, project }` instead of an HTTP 500 / raw 409.
 *
 * The tests drive createProjectSafely() with an in-memory stub repository so
 * the exact race semantics are exercised deterministically:
 *   1. single winner   - exactly one request creates the project
 *   2. all losers      - every losing request re-reads the winner and gets
 *                        { alreadyExists: true, project: winner }
 *   3. same response   - winner and losers return the same project object
 *   4. db consistency  - only ONE project row ever exists per unique key
 *   5. idempotency     - repeated conversion after the race returns the
 *                        existing project (no second insert)
 *   6. non-23505       - real failures still propagate (500 path preserved)
 *   7. duplicateConflict safety net - 23505 with unobservable winner does not
 *                        throw; returns { duplicateConflict: true }
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createProjectSafely } = require("../utils/projectConversion");

const UNIQUE_VIOLATION = {
  code: "23505",
  message:
    'duplicate key value violates unique constraint "projects_lead_uq"',
  details: "Key (lead_id)=(lead-A) already exists.",
};

// ---------------------------------------------------------------------------
// In-memory PostgREST-like repository
// ---------------------------------------------------------------------------

class StubProjectRepo {
  constructor() {
    this.rows = [];
    this.nextId = 1;
    this.consecutiveConflict = false;
    this.forcedError = null;
  }

  findByKey(apiColumn, value) {
    return this.rows.find((row) => row[apiColumn] === value) || null;
  }

  async create(payload) {
    if (this.forcedError) {
      throw this.forcedError;
    }

    if (this.consecutiveConflict) {
      throw Object.assign(new Error(UNIQUE_VIOLATION.message), UNIQUE_VIOLATION);
    }

    const keyed = {};
    if (payload.leadId) keyed.leadId = payload.leadId;
    if (payload.quotationId) keyed.quotationId = payload.quotationId;

    // Simulate the partial unique index projects_lead_uq: reject a second
    // row for the same non-null lead_id.
    if (keyed.leadId && this.findByKey("leadId", keyed.leadId)) {
      throw Object.assign(new Error(UNIQUE_VIOLATION.message), UNIQUE_VIOLATION);
    }

    const row = {
      _id: `proj-${this.nextId++}`,
      projectName: payload.projectName,
      clientName: payload.clientName,
      projectOwner: payload.projectOwner,
      projectValue: payload.projectValue,
      ...keyed,
    };
    this.rows.push(row);
    return { ...row };
  }
}

// ---------------------------------------------------------------------------
// "real DB" race simulator: concurrent create() calls race against the unique
// index exactly like Postgres. One winner commits; everyone else gets 23505.
// ---------------------------------------------------------------------------

function buildRaceRepo() {
  const state = {
    rows: [],
    nextId: 1,
    inFlight: 0,
  };

  const repo = {
    async create(payload) {
      if (this.forcedError) {
        throw this.forcedError;
      }

      state.inFlight += 1;
      // Simulate the DB round-trip scheduling both INSERTs "concurrently".
      await new Promise((resolve) => setTimeout(resolve, 5));

      const keyed = {};
      if (payload.leadId) keyed.leadId = payload.leadId;
      if (payload.quotationId) keyed.quotationId = payload.quotationId;

      if (keyed.leadId && state.rows.some((row) => row.leadId === keyed.leadId)) {
        state.inFlight -= 1;
        throw Object.assign(new Error(UNIQUE_VIOLATION.message), UNIQUE_VIOLATION);
      }

      const row = {
        _id: `proj-${state.nextId++}`,
        projectName: payload.projectName,
        ...keyed,
      };
      state.rows.push(row);
      state.inFlight -= 1;
      return { ...row };
    },
    // The read that "another request's committed row" resolves to.
    async findFirst(apiColumn, value) {
      return state.rows.find((row) => row[apiColumn] === value) || null;
    },
    _state: state,
  };

  return repo;
}

const PROJECT_PAYLOAD = {
  projectName: "Acme Project 2026-08-07",
  clientName: "Acme Pvt Ltd",
  projectOwner: "Sales One",
  projectValue: 150000,
};

// ---------------------------------------------------------------------------
// 1 + 2 + 3 + 4. Concurrent requests: single winner, losers return the winner
// ---------------------------------------------------------------------------

test("concurrent conversions: exactly one winner, losers re-read the winner", async () => {
  const repo = buildRaceRepo();
  const leadId = "lead-A";

  const attempts = Array.from({ length: 8 }, () =>
    createProjectSafely({
      payload: { ...PROJECT_PAYLOAD, leadId },
      projectRepo: repo,
      findExisting: () => repo.findFirst("leadId", leadId),
    }),
  );

  const results = await Promise.all(attempts);

  // Exactly one winner created the project.
  const winners = results.filter((result) => result.alreadyExists === false);
  const losers = results.filter((result) => result.alreadyExists === true);
  assert.equal(winners.length, 1, "exactly one request must win the race");
  assert.equal(losers.length, results.length - 1, "every other request loses");

  // Database consistency: only ONE project row exists for the lead.
  assert.equal(repo._state.rows.length, 1, "only one project row may exist");
  assert.equal(repo._state.rows[0].leadId, leadId);

  // Every loser returns the same project as the winner.
  const winnerProjectId = winners[0].project._id;
  for (const loser of losers) {
    assert.equal(loser.project._id, winnerProjectId);
    assert.equal(loser.project.leadId, leadId);
  }

  // Response contract: the established business fields are present.
  for (const result of results) {
    assert.equal(typeof result.alreadyExists, "boolean");
    assert.ok(result.project, "project must be present in every response");
    assert.ok(result.project._id, "project id must be present");
  }
});

test("concurrent cross-endpoint conversions (lead path vs quotation path) converge on one project", async () => {
  const repo = buildRaceRepo();
  const leadId = "lead-B";
  const quotationId = "quo-B";

  const attempts = [];

  // Mirror POST /api/projects/from-lead/:leadId
  attempts.push(
    createProjectSafely({
      payload: { ...PROJECT_PAYLOAD, leadId, projectName: "Lead path" },
      projectRepo: repo,
      findExisting: () => repo.findFirst("leadId", leadId),
    }),
  );

  // Mirror POST /api/quotations/:id/convert (re-read by quotationId, then leadId)
  for (let i = 0; i < 3; i += 1) {
    attempts.push(
      createProjectSafely({
        payload: {
          ...PROJECT_PAYLOAD,
          quotationId,
          leadId: leadId,
          projectName: "Quotation path",
        },
        projectRepo: repo,
        findExisting: async () => {
          const byQuotation = await repo.findFirst("quotationId", quotationId);
          return byQuotation || repo.findFirst("leadId", leadId);
        },
      }),
    );
  }

  const results = await Promise.all(attempts);

  const winners = results.filter((result) => result.alreadyExists === false);
  assert.equal(winners.length, 1, "exactly one project is created across both endpoints");
  assert.equal(repo._state.rows.length, 1);
  assert.equal(repo._state.rows[0].leadId, leadId);

  // The established response is returned by every request, whichever endpoint.
  for (const result of results) {
    assert.ok(result.project._id);
    if (result.alreadyExists === true) {
      assert.equal(result.project._id, winners[0].project._id);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Idempotency: a later repeat conversion returns the existing project
// ---------------------------------------------------------------------------

test("repeat conversion after the race is idempotent", async () => {
  const repo = buildRaceRepo();
  const leadId = "lead-C";

  const first = await createProjectSafely({
    payload: { ...PROJECT_PAYLOAD, leadId },
    projectRepo: repo,
    findExisting: () => repo.findFirst("leadId", leadId),
  });
  assert.equal(first.alreadyExists, false);

  const second = await createProjectSafely({
    payload: { ...PROJECT_PAYLOAD, leadId },
    projectRepo: repo,
    findExisting: () => repo.findFirst("leadId", leadId),
  });
  assert.equal(second.alreadyExists, true);
  assert.equal(second.project._id, first.project._id);

  // No additional row was inserted.
  assert.equal(repo._state.rows.length, 1);
});

// ---------------------------------------------------------------------------
// 6. Non-23505 failures still propagate (no swallowing of real errors)
// ---------------------------------------------------------------------------

test("non-duplicate database errors are re-thrown (500 path preserved)", async () => {
  const repo = buildRaceRepo();
  repo.forcedError = Object.assign(
    new Error("connection reset"),
    { code: "PGRST301" },
  );

  await assert.rejects(
    createProjectSafely({
      payload: { ...PROJECT_PAYLOAD, leadId: "lead-D" },
      projectRepo: repo,
      findExisting: () => repo.findFirst("leadId", "lead-D"),
    }),
    (error) => error.code === "PGRST301",
  );
});

// ---------------------------------------------------------------------------
// 7. duplicateConflict safety net: 23505 but winner not yet observable
// ---------------------------------------------------------------------------

test("23505 with unobservable winner returns duplicateConflict, never throws", async () => {
  // A repo that reports 23505 but where the winning row is not readable
  // (e.g. read replica lag - theoretical under PostgREST, but must be safe).
  const conflictOnlyRepo = {
    async create() {
      throw Object.assign(new Error(UNIQUE_VIOLATION.message), UNIQUE_VIOLATION);
    },
  };

  const result = await createProjectSafely({
    payload: { ...PROJECT_PAYLOAD, leadId: "lead-E" },
    projectRepo: conflictOnlyRepo,
    findExisting: async () => null,
  });

  assert.equal(result.duplicateConflict, true);
  assert.ok(result.error);
  assert.equal(result.error.code, "23505");
});

// ---------------------------------------------------------------------------
// Winner-only side-effect contract, as enforced by quotationRoutes
// ---------------------------------------------------------------------------

test("side effects must run only for the winner (quotation convert contract)", async () => {
  const repo = buildRaceRepo();
  const leadId = "lead-F";

  const attempts = Array.from({ length: 4 }, () =>
    createProjectSafely({
      payload: { ...PROJECT_PAYLOAD, leadId },
      projectRepo: repo,
      findExisting: () => repo.findFirst("leadId", leadId),
    }),
  );

  const results = await Promise.all(attempts);

  let sideEffectCount = 0;
  for (const result of results) {
    // This mirrors the route guard: only !alreadyExists performs the
    // quotation.status="Approved" / lead.status="Closed" writes.
    if (!result.alreadyExists) {
      sideEffectCount += 1;
    }
  }

  assert.equal(sideEffectCount, 1, "only the winning request may run side effects");
});
