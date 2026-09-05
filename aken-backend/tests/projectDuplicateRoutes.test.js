"use strict";

/**
 * projectDuplicateRoutes.test.js
 * ----------------------------------------------------------------------------
 * HTTP-level tests for B1: the generic project endpoints must map SQLSTATE
 * 23505 (projects_lead_uq) to a stable 409 business response instead of 500.
 *
 * Coverage:
 *   1. Duplicate lead create    - POST /api/projects         -> 409
 *   2. Duplicate lead update    - PUT /api/projects/:id      -> 409
 *   3. Concurrent requests      - exactly one 201, rest 409  (same payload)
 *   4. Existing compatibility   - success envelope unchanged, non-23505 still
 *                                 500, validation still 400
 *   5. from-lead alignment      - duplicateConflict safety net emits the same
 *                                 flat 409 envelope as the generic endpoints
 *
 * The router is mounted on a real Express app served over an ephemeral port so
 * the full middleware + catch-block path is exercised (no supertest dependency).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");

const express = require("express");

// ---------------------------------------------------------------------------
// Middleware bypass (must run BEFORE the router is required so the router
// binds the replaced functions). Plain assignment so mock.restoreAll() in
// per-test cleanup never disturbs them.
// ---------------------------------------------------------------------------

const authCookies = require("../utils/authCookies");
const csrf = require("../middleware/csrf");
const rateLimiters = require("../middleware/rateLimiters");

authCookies.getTokenFromRequest = () => "test-session-token";
authCookies.verifySessionToken = () => ({
  id: "user-1",
  name: "Admin",
  role: "admin",
});
csrf.csrfProtection = (req, res, next) => next();
rateLimiters.leadMutationLimiter = (req, res, next) => next();

// ---------------------------------------------------------------------------
// Router + models
// ---------------------------------------------------------------------------

const Project = require("../models/Project");
const Lead = require("../models/Lead");
const projectRoutes = require("../routes/projectRoutes");

const LEAD_UUID_A = "11111111-1111-4111-8111-111111111111";
const LEAD_UUID_B = "22222222-2222-4222-8222-222222222222";

const CREATE_PAYLOAD = {
  projectName: "Acme Warehouse Project",
  clientName: "Acme Pvt Ltd",
  projectValue: 150000,
  leadId: LEAD_UUID_A,
};

const UPDATE_PAYLOAD = {
  leadId: LEAD_UUID_B,
};

// The exact RepositoryError shape createRepository.saveDocument /
// runUpdateOperation produce for a projects_lead_uq violation.
function projectLeadConflictError({ constraint = "projects_lead_uq" } = {}) {
  return Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    {
      name: "RepositoryError",
      code: "23505",
      details: `Key (lead_id)=(${LEAD_UUID_A}) already exists.`,
      dbTable: "projects",
      constraint,
    },
  );
}

function nonDuplicateDbError() {
  return Object.assign(new Error("connection reset"), { code: "PGRST301" });
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/projects", projectRoutes);

  const server = await new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl };
}

async function postProject(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

async function putProject(baseUrl, id, payload) {
  const response = await fetch(`${baseUrl}/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

const DUPLICATE_409_BODY = {
  success: false,
  code: "DUPLICATE_PROJECT_FOR_LEAD",
  message: "A project already exists for this lead.",
};

// ---------------------------------------------------------------------------
// 1. Duplicate lead create -> 409 (never 500)
// ---------------------------------------------------------------------------

test("POST /api/projects with a lead that already has a project returns 409 DUPLICATE_PROJECT_FOR_LEAD", async (t) => {
  mock.method(Project, "create", async () => {
    throw projectLeadConflictError();
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const result = await postProject(baseUrl, CREATE_PAYLOAD);

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, DUPLICATE_409_BODY);
});

test("POST /api/projects duplicate is recognized from the details column even without the constraint field", async (t) => {
  const conflict = projectLeadConflictError();
  delete conflict.constraint;
  delete conflict.message;

  mock.method(Project, "create", async () => {
    throw Object.assign(new Error("duplicate key value"), conflict);
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const result = await postProject(baseUrl, CREATE_PAYLOAD);

  assert.equal(result.status, 409);
  assert.equal(result.body.code, "DUPLICATE_PROJECT_FOR_LEAD");
});

// ---------------------------------------------------------------------------
// 2. Duplicate lead update -> 409 (re-pointing a project to a taken lead)
// ---------------------------------------------------------------------------

test("PUT /api/projects/:id that would take an already-used lead returns 409 DUPLICATE_PROJECT_FOR_LEAD", async (t) => {
  mock.method(Project, "findByIdAndUpdate", async () => {
    throw projectLeadConflictError();
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const result = await putProject(baseUrl, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", UPDATE_PAYLOAD);

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, DUPLICATE_409_BODY);
});

// ---------------------------------------------------------------------------
// 3. Concurrent requests -> exactly one 201, every loser 409 (no 500)
// ---------------------------------------------------------------------------

test("concurrent POSTs for the same lead: one winner (201), all losers 409, identical error body", async (t) => {
  let insertCount = 0;
  mock.method(Project, "create", async () => {
    insertCount += 1;
    if (insertCount === 1) {
      return {
        _id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        projectName: CREATE_PAYLOAD.projectName,
        clientName: CREATE_PAYLOAD.clientName,
        projectValue: CREATE_PAYLOAD.projectValue,
        leadId: CREATE_PAYLOAD.leadId,
      };
    }
    throw projectLeadConflictError();
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const attempts = Array.from({ length: 6 }, () => postProject(baseUrl, CREATE_PAYLOAD));
  const results = await Promise.all(attempts);

  const statuses = results.map((result) => result.status);
  assert.equal(insertCount, 6, "every request must reach the insert path");
  assert.equal(
    statuses.filter((status) => status === 201).length,
    1,
    "exactly one request wins the race",
  );
  assert.equal(
    statuses.filter((status) => status === 409).length,
    results.length - 1,
    "every other request must receive the stable 409",
  );
  assert.equal(
    statuses.some((status) => status === 500),
    false,
    "no loser may surface as HTTP 500",
  );

  for (const result of results.filter((item) => item.status === 409)) {
    assert.deepEqual(result.body, DUPLICATE_409_BODY, "loser error body must be identical and stable");
  }
});

// ---------------------------------------------------------------------------
// 4. Existing response compatibility
// ---------------------------------------------------------------------------

test("successful create still returns 201 with the { success, data, requestId } envelope", async (t) => {
  const created = {
    _id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    projectName: CREATE_PAYLOAD.projectName,
    clientName: CREATE_PAYLOAD.clientName,
    projectValue: CREATE_PAYLOAD.projectValue,
    leadId: CREATE_PAYLOAD.leadId,
  };
  mock.method(Project, "create", async () => created);
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const result = await postProject(baseUrl, CREATE_PAYLOAD);

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data._id, created._id);
  assert.equal(result.body.data.leadId, CREATE_PAYLOAD.leadId);
  assert.ok("requestId" in result.body, "requestId key must be present");
});

test("non-23505 create failures still return 500 PROJECT_CREATE_FAILED (nested envelope unchanged)", async (t) => {
  mock.method(Project, "create", async () => {
    throw nonDuplicateDbError();
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const result = await postProject(baseUrl, CREATE_PAYLOAD);

  assert.equal(result.status, 500);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, "PROJECT_CREATE_FAILED");
  assert.equal(result.body.error.message, "Unable to create project.");
});

test("non-23505 update failures still return 500 PROJECT_UPDATE_FAILED (nested envelope unchanged)", async (t) => {
  mock.method(Project, "findByIdAndUpdate", async () => {
    throw nonDuplicateDbError();
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const result = await putProject(baseUrl, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", UPDATE_PAYLOAD);

  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "PROJECT_UPDATE_FAILED");
});

test("validation failures are unchanged: 400 PROJECT_VALIDATION_FAILED before any write", async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const result = await postProject(baseUrl, { projectName: "", clientName: "Acme", projectValue: -5 });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "PROJECT_VALIDATION_FAILED");
});

// ---------------------------------------------------------------------------
// 5. from-lead duplicateConflict safety net uses the same flat 409 envelope
// ---------------------------------------------------------------------------

test("POST /api/projects/from-lead/:leadId unobservable-winner race emits the same flat 409 body", async (t) => {
  mock.method(Lead, "findById", async () => ({
    _id: LEAD_UUID_A,
    status: "Closed",
    companyName: "Acme Pvt Ltd",
    owner: "Sales One",
    dealValue: 150000,
  }));
  // Fast-path pre-check misses, then the race loser's re-read also misses,
  // forcing the duplicateConflict safety net.
  mock.method(Project, "findOne", async () => null);
  mock.method(Project, "create", async () => {
    throw projectLeadConflictError();
  });
  t.after(() => mock.restoreAll());

  const { server, baseUrl } = await startTestServer();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/projects/from-lead/${LEAD_UUID_A}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.deepEqual(body, DUPLICATE_409_BODY);
});
