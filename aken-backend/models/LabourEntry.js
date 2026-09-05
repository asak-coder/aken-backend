// PostgreSQL repository for the labour_entries table (was: Mongoose LabourEntry model).
const { createRepository } = require("./createRepository");

const LabourEntry = createRepository({
  table: "labour_entries",
  fieldMap: {
    id: "_id",
    project_id: "projectId",
    role: "role",
    workers: "workers",
    working_days: "workingDays",
    total_cost: "totalCost",
    output_quantity: "outputQuantity",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  relations: {
    projectId: {
      table: "projects",
      rowMap: {
        id: "_id",
        project_name: "projectName",
        client_name: "clientName",
        status: "status",
      },
    },
  },
  subTables: {},
});

module.exports = LabourEntry;
