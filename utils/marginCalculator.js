function calculateMargin(project) {
  const totalCost =
    project.materialCost +
    project.labourCost +
    project.equipmentCost +
    project.otherCost;

  const profit = project.projectValue - totalCost;

  const marginPercentage =
    project.projectValue > 0
      ? (profit / project.projectValue) * 100
      : 0;

  return {
    totalCost,
    profit,
    marginPercentage,
  };
}

module.exports = calculateMargin;