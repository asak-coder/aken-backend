const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");

router.post("/", async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.status(201).json({ message: "Lead created successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to create lead" });
  }
});

module.exports = router;

