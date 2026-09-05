// PostgreSQL repository for the tenders table (was: Mongoose Tender model).
const { createRepository } = require("./createRepository");

const Tender = createRepository({
  table: "tenders",
  fieldMap: {
    id: "_id",
    tender_name: "tenderName",
    client: "client",
    estimated_value: "estimatedValue",
    submission_date: "submissionDate",
    status: "status",
    probability: "probability",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  relations: {},
  subTables: {},
});

module.exports = Tender;
