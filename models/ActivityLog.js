const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  leadId: String,
  action: String,
  performedBy: String,
}, { timestamps: true });

module.exports = mongoose.model("ActivityLog", activitySchema);