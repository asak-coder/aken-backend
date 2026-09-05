// PostgreSQL repository for the boq_entries table (was: Mongoose BOQ model).
const { createRepository } = require("./createRepository");

const BOQ = createRepository({
  table: "boq_entries",
  fieldMap: {
    id: "_id",
    project_id: "projectId",
    description: "description",
    boq_qty: "boqQty",
    boq_rate: "boqRate",
    actual_qty: "actualQty",
    actual_cost: "actualCost",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  relations: {},
  subTables: {},
});

module.exports = BOQ;
