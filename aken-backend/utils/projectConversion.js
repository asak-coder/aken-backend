/**
 * projectConversion.js
 * ----------------------------------------------------------------------------
 * Concurrency-safe Lead/Quotation -> Project conversion core (F3).
 *
 * Phase 2 added the partial unique index `projects_lead_uq` (one project per
 * lead, non-null lead_id). Both conversion endpoints previously did a
 * findOne() pre-check followed by create(). Under concurrent requests both can
 * pass the pre-check and the second INSERT fails with SQLSTATE 23505, which
 * surfaced as HTTP 500 / generic 409 instead of the established business
 * response `{ alreadyExists: true, project }`.
 *
 * createProjectSafely() owns that race:
 *   1. try Project.create(payload)             -> winner path
 *   2. on SQLSTATE 23505, re-read the project that committed first via the
 *      caller-supplied findExisting() lookup   -> established business response
 *   3. safety net: if the winning row is not visible through the lookup
 *      (should not happen via PostgREST, which commits per request), return
 *      { duplicateConflict: true } so the route can emit a stable 409 -
 *      never HTTP 500 for a 23505 race.
 *
 * The helper is dependency-injectable (projectRepo / findExisting) so the
 * exact race semantics are unit-testable without a live database.
 */

const Project = require("../models/Project");
const { isDuplicateKeyError } = require("./duplicateKeyError");

/**
 * Create a project or, if another request already created one for the same
 * unique key (SQLSTATE 23505), return the existing project.
 *
 * @param {object} options
 * @param {object} options.payload     Project payload for Project.create().
 * @param {Function} options.findExisting  Async () => Project|null. Re-reads the
 *                                     committed winner by the unique key.
 * @param {object} [options.projectRepo]   Repository with .create(); defaults
 *                                     to the real Project model (tests inject
 *                                     a stub).
 * @returns {Promise<{alreadyExists: boolean, project: object}
 *            | {duplicateConflict: true, error: Error}>}
 */
async function createProjectSafely({
  payload,
  findExisting,
  projectRepo = Project,
}) {
  try {
    const project = await projectRepo.create(payload);
    return { alreadyExists: false, project };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await findExisting();
    if (existing) {
      return { alreadyExists: true, project: existing };
    }

    // Unique conflict but no visible row. Do not bubble 23505 up as a 500 -
    // hand the caller a stable duplicate-conflict signal instead.
    return { duplicateConflict: true, error };
  }
}

module.exports = { createProjectSafely };
