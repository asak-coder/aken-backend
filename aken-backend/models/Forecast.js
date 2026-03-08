const mongoose = require("mongoose");

const forecastSchema = new mongoose.Schema({
  month: String,
  projectedRevenue: Number,
  confirmedRevenue: Number,
  cashInflow: Number
});

module.exports = mongoose.model("Forecast", forecastSchema);