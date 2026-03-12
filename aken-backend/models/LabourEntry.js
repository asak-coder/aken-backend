const mongoose = require("mongoose");

const labourSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    role: { type: String, trim: true, required: true, index: true },
    workers: { type: Number, default: 0, min: 0 },
    workingDays: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    outputQuantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Common query patterns:
// - list by project, newest first
// - list by project + role
labourSchema.index({ projectId: 1, createdAt: -1 });
labourSchema.index({ projectId: 1, role: 1 });

module.exports = mongoose.model("LabourEntry", labourSchema);
