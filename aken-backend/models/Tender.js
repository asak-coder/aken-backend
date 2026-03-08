const mongoose = require("mongoose");

const tenderSchema = new mongoose.Schema({
  tenderName: String,
  client: String,
  estimatedValue: Number,
  submissionDate: Date,
  status: {
    type: String,
    enum: ["Preparing", "Submitted", "Under Review", "Won", "Lost"],
    default: "Preparing"
  },
  probability: Number
});

module.exports = mongoose.model("Tender", tenderSchema);