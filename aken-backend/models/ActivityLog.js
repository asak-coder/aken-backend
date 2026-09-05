// PostgreSQL repository for the activity_logs table (was: Mongoose ActivityLog model).
const { createRepository } = require("./createRepository");

const ActivityLog = createRepository({
  table: "activity_logs",
  fieldMap: {
    id: "_id",
    lead_id: "leadId",
    action: "action",
    performed_by: "performedBy",
    created_at: "createdAt",
  },
  relations: {},
  subTables: {},
});

module.exports = ActivityLog;
