const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    contactPerson: String,
    email: String,
    companyName: String,
    phone: String,
    message: String,
    status: {
      type: String,
      enum: ["New", "Contacted", "Quoted", "Closed"],
      default: "New",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);
