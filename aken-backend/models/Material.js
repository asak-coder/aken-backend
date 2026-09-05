// PostgreSQL repository for the materials table (was: Mongoose Material model).
const { createRepository } = require("./createRepository");

const Material = createRepository({
  table: "materials",
  fieldMap: {
    id: "_id",
    project_id: "projectId",
    material_name: "materialName",
    planned_qty: "plannedQty",
    ordered_qty: "orderedQty",
    received_qty: "receivedQty",
    used_qty: "usedQty",
    rate: "rate",
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

module.exports = Material;
