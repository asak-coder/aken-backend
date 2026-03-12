const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: false,
      index: true,
    },

    quotationNumber: { type: String, trim: true, index: true },

    items: [
      {
        description: { type: String, trim: true, required: true },
        quantity: { type: Number, required: true, min: 0 },
        rate: { type: Number, required: true, min: 0 },
        amount: { type: Number, required: true, min: 0 },
      },
    ],

    subtotal: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["Draft", "Sent", "Approved", "Rejected"],
      default: "Draft",
      index: true,
    },

    validTill: { type: Date, index: true },
  },
  { timestamps: true }
);

// Common query patterns:
// - list by status, newest first
// - list by lead, newest first
quotationSchema.index({ status: 1, createdAt: -1 });
quotationSchema.index({ leadId: 1, createdAt: -1 });

module.exports = mongoose.model("Quotation", quotationSchema);
