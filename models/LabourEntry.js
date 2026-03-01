const mongoose = require("mongoose");

const labourSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },

  role: String,
  workers: Number,
  workingDays: Number,
  totalCost: Number,
  outputQuantity: Number,

}, { timestamps: true });

module.exports = mongoose.model("LabourEntry", labourSchema);