const express = require("express");
const router = express.Router();
const Quotation = require("../models/Quotation");

// Create Quotation
router.post("/", async (req, res) => {
  try {
    const quotation = await Quotation.create(req.body);
    res.status(201).json(quotation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Quotations
router.get("/", async (req, res) => {
  const quotations = await Quotation.find().populate("leadId");
  res.json(quotations);
});

module.exports = router;