const mongoose = require("mongoose");

const forecastSchema = new mongoose.Schema(
  {
    // Store as YYYY-MM to keep sorting/filtering simple
    month: { type: String, trim: true, required: true, index: true },
    projectedRevenue: { type: Number, default: 0, min: 0 },
    confirmedRevenue: { type: Number, default: 0, min: 0 },
    cashInflow: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Common query patterns:
// - list newest forecasts
// - find by month
forecastSchema.index({ month: 1 }, { unique: true });

module.exports = mongoose.model("Forecast", forecastSchema);
