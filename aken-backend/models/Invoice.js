// PostgreSQL repository for the invoices table (was: Mongoose Invoice model).
const { createRepository } = require("./createRepository");

const Invoice = createRepository({
  table: "invoices",
  fieldMap: {
    id: "_id",
    project_id: "projectId",
    invoice_number: "invoiceNumber",
    amount: "amount",
    paid_amount: "paidAmount",
    due_date: "dueDate",
    status: "status",
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
        project_owner: "projectOwner",
        status: "status",
      },
    },
  },
  subTables: {},
});

module.exports = Invoice;
