const mongoose = require("mongoose");

const boqSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    description: { type: String, trim: true, required: true },

    boqQty: { type: Number, required: true, min: 0 },
    boqRate: { type: Number, required: true, min: 0 },

    actualQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    actualCost: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Common query patterns:
// - list by project, newest first
boqSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("BOQ", boqSchema);
