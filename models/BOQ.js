const mongoose = require("mongoose");

const boqSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },

  description: String,

  boqQty: Number,
  boqRate: Number,

  actualQty: {
    type: Number,
    default: 0,
  },

  actualCost: {
    type: Number,
    default: 0,
  },

}, { timestamps: true });

module.exports = mongoose.model("BOQ", boqSchema);