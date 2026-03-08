const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },

  materialName: String,

  plannedQty: Number,
  orderedQty: Number,
  receivedQty: Number,
  usedQty: Number,

  rate: Number,

}, { timestamps: true });

module.exports = mongoose.model("Material", materialSchema);