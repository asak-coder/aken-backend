// PostgreSQL repository for the quotations table (was: Mongoose Quotation model).
// Rebuilds the embedded `items` array via a 1:N join on quotation_items.
const { createRepository } = require("./createRepository");
const { roundMoney } = require("../utils/quotationTotals");

// Persistence-boundary guard (F1 fix):
// The repository calls beforeSave(doc) immediately before every INSERT/UPDATE.
// We recompute totalAmount from the subtotal/gst that are actually being
// written, so no write path can persist a row that violates the Phase 2
// CHECK constraint `quotations_total_integrity (total_amount = subtotal + gst)`.
function enforceTotalIntegrity(doc) {
  const subtotal = roundMoney(doc.subtotal);
  const gst = roundMoney(doc.gst);
  doc.subtotal = subtotal;
  doc.gst = gst;
  doc.totalAmount = roundMoney(subtotal + gst);
}

const Quotation = createRepository({
  table: "quotations",
  fieldMap: {
    id: "_id",
    lead_id: "leadId",
    quotation_number: "quotationNumber",
    subtotal: "subtotal",
    gst: "gst",
    total_amount: "totalAmount",
    status: "status",
    valid_till: "validTill",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  relations: {
    leadId: {
      table: "leads",
      rowMap: {
        id: "_id",
        contact_person: "contactPerson",
        company_name: "companyName",
        email: "email",
        status: "status",
        owner: "owner",
      },
    },
  },
  joinConfigs: {
    items: {
      apiName: "items",
      table: "quotation_items",
      fkColumn: "quotation_id",
      cardinality: "1:N",
      positionField: "position",
      rowMap: {
        id: "_id",
        description: "description",
        quantity: "quantity",
        rate: "rate",
        amount: "amount",
        created_at: "createdAt",
        position: "position",
      },
    },
  },
  joins: [
    {
      apiName: "items",
      table: "quotation_items",
      fkColumn: "quotation_id",
      cardinality: "1:N",
      orderBy: { position: 1 },
      rowMap: {
        id: "_id",
        description: "description",
        quantity: "quantity",
        rate: "rate",
        amount: "amount",
        created_at: "createdAt",
      },
    },
  ],
  beforeSave: enforceTotalIntegrity,
});

module.exports = Quotation;
