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
    owner: {
      type: String,
      default: "Unassigned"
    },
    notes: [
      {
        text: String,
        addedBy: String,
        createdAt: { type: Date, default: Date.now }
      }
    ],
    dealValue: Number,
    probability: {
      type: Number,
      default: 50
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);
