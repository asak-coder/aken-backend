const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead",
  },

  quotationNumber: String,

  items: [
    {
      description: String,
      quantity: Number,
      rate: Number,
      amount: Number,
    },
  ],

  subtotal: Number,
  gst: Number,
  totalAmount: Number,

  status: {
    type: String,
    enum: ["Draft", "Sent", "Approved", "Rejected"],
    default: "Draft",
  },

  validTill: Date,
}, { timestamps: true });

module.exports = mongoose.model("Quotation", quotationSchema);