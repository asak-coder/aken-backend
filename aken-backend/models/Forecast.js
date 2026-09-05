// PostgreSQL repository for the forecasts table (was: Mongoose Forecast model).
const { createRepository } = require("./createRepository");

const Forecast = createRepository({
  table: "forecasts",
  fieldMap: {
    id: "_id",
    month: "month",
    projected_revenue: "projectedRevenue",
    confirmed_revenue: "confirmedRevenue",
    cash_inflow: "cashInflow",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  relations: {},
  subTables: {},
});

module.exports = Forecast;
