const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({

  quotationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quotation",
  },

  projectName: String,
  clientName: String,

  projectValue: {
    type: Number,
    required: true
  },

  startDate: Date,
  expectedCompletion: Date,

  status: {
    type: String,
    enum: ["Planning", "In Progress", "Completed"],
    default: "Planning",
  },

  progressPercentage: {
    type: Number,
    default: 0
  },

  budgetAllocated: {
    type: Number,
    default: 0
  },

  budgetSpent: {
    type: Number,
    default: 0
  },

  siteStatus: {
    type: String,
    enum: [
      "Not Started",
      "Foundation",
      "Structure",
      "Cladding",
      "Finishing",
      "Completed"
    ],
    default: "Not Started"
  },

  materialCost: {
    type: Number,
    default: 0
  },

  labourCost: {
    type: Number,
    default: 0
  },

  equipmentCost: {
    type: Number,
    default: 0
  },

  otherCost: {
    type: Number,
    default: 0
  },

  dailyExpense: {
    type: Number,
    default: 0
  },

  totalSpent: {
    type: Number,
    default: 0
  }

}, { timestamps: true });


// 🔥 Margin + Budget Protection Hook
projectSchema.pre("save", function(next) {

  if (this.budgetAllocated > 0 && this.budgetSpent > this.budgetAllocated) {
    console.log("⚠ Project Over Budget");
  }

  if (this.progressPercentage > 100) {
    this.progressPercentage = 100;
  }

  next();
});

module.exports = mongoose.model("Project", projectSchema);