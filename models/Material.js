const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    materialName: { type: String, trim: true, required: true, index: true },

    plannedQty: { type: Number, default: 0, min: 0 },
    orderedQty: { type: Number, default: 0, min: 0 },
    receivedQty: { type: Number, default: 0, min: 0 },
    usedQty: { type: Number, default: 0, min: 0 },

    rate: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Common query patterns:
// - list by project, newest first
// - search by project + materialName
materialSchema.index({ projectId: 1, createdAt: -1 });
materialSchema.index({ projectId: 1, materialName: 1 });

module.exports = mongoose.model("Material", materialSchema);
