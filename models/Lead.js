const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    projectType: { type: String },
    location: { type: String },
    message: { type: String },
    status: { type: String, default: "New" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", LeadSchema);
