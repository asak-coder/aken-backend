const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    invoiceNumber: { type: String, trim: true, index: true },
    amount: { type: Number, required: true, min: 0 },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueDate: { type: Date, index: true },

    status: {
      type: String,
      enum: ["Pending", "Partially Paid", "Paid"],
      default: "Pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Common query patterns:
// - list invoices by project (newest first)
// - list invoices by status (newest first)
invoiceSchema.index({ projectId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
