function toAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function roundAmount(value) {
  return Number(value.toFixed(2));
}

function toPercentage(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return roundAmount((numerator / denominator) * 100);
}

function clampProgress(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed));
}

function evaluateRiskSignals({
  revenue,
  actualCost,
  actualMarginPercentage,
  budgetAllocated,
  progressPercentage,
}) {
  const riskReasons = [];
  let riskLevel = "Healthy";

  if (revenue <= 0) {
    riskLevel = "Watch";
    riskReasons.push("Project revenue is zero. Margin quality is not measurable.");
  }

  if (actualMarginPercentage < 0) {
    riskLevel = "Loss";
    riskReasons.push("Actual profit is negative.");
  } else if (actualMarginPercentage < 8) {
    riskLevel = riskLevel === "Loss" ? "Loss" : "High";
    riskReasons.push("Actual margin is below 8% target.");
  } else if (actualMarginPercentage < 15) {
    if (riskLevel !== "Loss" && riskLevel !== "High") {
      riskLevel = "Watch";
    }
    riskReasons.push("Actual margin is below 15% comfort range.");
  }

  const budgetUtilizationPercentage = toPercentage(actualCost, budgetAllocated);
  if (budgetAllocated > 0 && budgetUtilizationPercentage > 100) {
    riskLevel = riskLevel === "Loss" ? "Loss" : "High";
    riskReasons.push("Actual cost has exceeded allocated budget.");
  } else if (budgetAllocated > 0 && budgetUtilizationPercentage > 90) {
    if (riskLevel === "Healthy") {
      riskLevel = "Watch";
    }
    riskReasons.push("Budget utilization is above 90%.");
  }

  if (progressPercentage > 80 && actualMarginPercentage < 10) {
    riskLevel = riskLevel === "Loss" ? "Loss" : "High";
    riskReasons.push(
      "Project is near completion while margin buffer is still low.",
    );
  }

  return {
    riskLevel,
    riskReasons,
    budgetUtilizationPercentage,
    overBudget: budgetAllocated > 0 && actualCost > budgetAllocated,
  };
}

function calculateMargin(project = {}, options = {}) {
  const revenue = toAmount(options.revenue ?? project.projectValue);

  const baselineCost =
    toAmount(project.totalSpent) ||
    toAmount(project.materialCost) +
      toAmount(project.labourCost) +
      toAmount(project.equipmentCost) +
      toAmount(project.otherCost) +
      toAmount(project.dailyExpense);

  const estimatedCostFromProject =
    toAmount(project.budgetAllocated) || baselineCost;
  const estimatedCost = toAmount(options.estimatedCost ?? estimatedCostFromProject);
  const normalizedEstimatedCost =
    estimatedCost > 0 ? estimatedCost : baselineCost;

  const actualCost = toAmount(options.actualCost ?? baselineCost);

  const expectedProfit = roundAmount(revenue - normalizedEstimatedCost);
  const expectedMarginPercentage = toPercentage(expectedProfit, revenue);

  const actualProfit = roundAmount(revenue - actualCost);
  const actualMarginPercentage = toPercentage(actualProfit, revenue);

  const costVariance = roundAmount(actualCost - normalizedEstimatedCost);
  const costVariancePercentage = toPercentage(costVariance, normalizedEstimatedCost);
  const profitVariance = roundAmount(actualProfit - expectedProfit);
  const marginVariancePoints = roundAmount(
    actualMarginPercentage - expectedMarginPercentage,
  );

  const budgetAllocated = toAmount(options.budgetAllocated ?? project.budgetAllocated);
  const budgetSpent = toAmount(options.budgetSpent ?? actualCost);
  const budgetRemaining = roundAmount(Math.max(0, budgetAllocated - budgetSpent));

  const progressPercentage = clampProgress(
    options.progressPercentage ?? project.progressPercentage,
  );

  const signals = evaluateRiskSignals({
    revenue,
    actualCost,
    actualMarginPercentage,
    budgetAllocated,
    progressPercentage,
  });

  const payload = {
    revenue,
    expected: {
      cost: normalizedEstimatedCost,
      profit: expectedProfit,
      marginPercentage: expectedMarginPercentage,
    },
    actual: {
      cost: actualCost,
      profit: actualProfit,
      marginPercentage: actualMarginPercentage,
    },
    variance: {
      cost: costVariance,
      costPercentage: costVariancePercentage,
      profit: profitVariance,
      marginPoints: marginVariancePoints,
    },
    budget: {
      allocated: budgetAllocated,
      spent: budgetSpent,
      remaining: budgetRemaining,
      utilizationPercentage: signals.budgetUtilizationPercentage,
    },
    progressPercentage,
    signals,
  };

  // Backward compatibility with existing consumers.
  payload.totalCost = payload.actual.cost;
  payload.profit = payload.actual.profit;
  payload.marginPercentage = payload.actual.marginPercentage;

  return payload;
}

module.exports = calculateMargin;

