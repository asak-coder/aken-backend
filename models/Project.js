const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    projectOwner: {
      type: String,
      trim: true,
      default: "Unassigned",
      maxlength: 80,
    },
    projectValue: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    expectedCompletion: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Planning", "In Progress", "Completed"],
      default: "Planning",
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    budgetAllocated: {
      type: Number,
      default: 0,
      min: 0,
    },
    budgetSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    siteStatus: {
      type: String,
      enum: [
        "Not Started",
        "Foundation",
        "Structure",
        "Cladding",
        "Finishing",
        "Completed",
      ],
      default: "Not Started",
    },
    materialCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    labourCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    equipmentCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    dailyExpense: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

projectSchema.index({ quotationId: 1 });
projectSchema.index({ leadId: 1 });
projectSchema.index({ status: 1, siteStatus: 1 });

projectSchema.pre("save", function applyProjectGuards(next) {
  this.progressPercentage = Math.min(100, Math.max(0, this.progressPercentage || 0));

  const categoryTotal =
    (this.materialCost || 0) +
    (this.labourCost || 0) +
    (this.equipmentCost || 0) +
    (this.otherCost || 0) +
    (this.dailyExpense || 0);

  this.totalSpent = categoryTotal > 0 ? categoryTotal : this.budgetSpent || 0;

  if (this.budgetAllocated > 0 && this.totalSpent > this.budgetAllocated) {
    console.warn(
      `[project] budget exceeded for ${this.projectName}: spent=${this.totalSpent}, allocated=${this.budgetAllocated}`,
    );
  }

  if (this.status === "Completed") {
    this.progressPercentage = 100;
    this.siteStatus = "Completed";
  }

  next();
});

module.exports = mongoose.model("Project", projectSchema);