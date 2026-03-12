const mongoose = require("mongoose");

const tenderSchema = new mongoose.Schema(
  {
    tenderName: { type: String, trim: true, required: true, index: true },
    client: { type: String, trim: true, required: true, index: true },
    estimatedValue: { type: Number, default: 0, min: 0 },
    submissionDate: { type: Date, index: true },
    status: {
      type: String,
      enum: ["Preparing", "Submitted", "Under Review", "Won", "Lost"],
      default: "Preparing",
      index: true,
    },
    probability: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

// Common query patterns:
// - list by status (newest first)
// - list by submission date
tenderSchema.index({ status: 1, createdAt: -1 });
tenderSchema.index({ submissionDate: 1 });

module.exports = mongoose.model("Tender", tenderSchema);
