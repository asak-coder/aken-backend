const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },

  invoiceNumber: String,
  amount: Number,

  paidAmount: {
    type: Number,
    default: 0,
  },

  dueDate: Date,

  status: {
    type: String,
    enum: ["Pending", "Partially Paid", "Paid"],
    default: "Pending",
  },
}, { timestamps: true });

module.exports = mongoose.model("Invoice", invoiceSchema);