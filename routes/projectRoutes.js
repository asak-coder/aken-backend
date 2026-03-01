const calculateMargin = require("../utils/marginCalculator");

router.get("/:id/margin", async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project)
    return res.status(404).json({ error: "Project not found" });

  const result = calculateMargin(project);

  res.json(result);
});