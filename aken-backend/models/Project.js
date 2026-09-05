// PostgreSQL repository for the projects table (was: Mongoose Project model).
// Reproduces the Mongoose Project.pre("save") guards in beforeSave:
//   - clamp progressPercentage to 0-100
//   - recompute totalSpent = material+labour+equipment+other+daily (fallback budgetSpent)
//   - warn if budget exceeded
//   - force 100%/Completed on status === "Completed"
const { createRepository } = require("./createRepository");

function applyProjectGuards(doc) {
  const progress = Number(doc.progressPercentage) || 0;
  doc.progressPercentage = Math.min(100, Math.max(0, progress));

  const categoryTotal =
    (Number(doc.materialCost) || 0) +
    (Number(doc.labourCost) || 0) +
    (Number(doc.equipmentCost) || 0) +
    (Number(doc.otherCost) || 0) +
    (Number(doc.dailyExpense) || 0);

  doc.totalSpent = categoryTotal > 0 ? categoryTotal : Number(doc.budgetSpent) || 0;

  if (Number(doc.budgetAllocated) > 0 && doc.totalSpent > Number(doc.budgetAllocated)) {
    console.warn(
      `[project] budget exceeded for ${doc.projectName}: spent=${doc.totalSpent}, allocated=${doc.budgetAllocated}`,
    );
  }

  if (doc.status === "Completed") {
    doc.progressPercentage = 100;
    doc.siteStatus = "Completed";
  }
}

const Project = createRepository({
  table: "projects",
  fieldMap: {
    id: "_id",
    quotation_id: "quotationId",
    lead_id: "leadId",
    project_name: "projectName",
    client_name: "clientName",
    project_owner: "projectOwner",
    project_value: "projectValue",
    start_date: "startDate",
    expected_completion: "expectedCompletion",
    status: "status",
    progress_percentage: "progressPercentage",
    budget_allocated: "budgetAllocated",
    budget_spent: "budgetSpent",
    site_status: "siteStatus",
    material_cost: "materialCost",
    labour_cost: "labourCost",
    equipment_cost: "equipmentCost",
    other_cost: "otherCost",
    daily_expense: "dailyExpense",
    total_spent: "totalSpent",
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
        status: "status",
        owner: "owner",
        email: "email",
      },
    },
    quotationId: {
      table: "quotations",
      rowMap: {
        id: "_id",
        quotation_number: "quotationNumber",
        status: "status",
        total_amount: "totalAmount",
      },
    },
  },
  beforeSave: applyProjectGuards,
});

module.exports = Project;
