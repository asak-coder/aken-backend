const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  leadId: String,
  action: String,
  performedBy: String,
}, { timestamps: true });
await ActivityLog.create({
  leadId: lead._id,
  action: `Status changed to ${newStatus}`,
  performedBy: req.user.id
});

module.exports = mongoose.model("ActivityLog", activitySchema);