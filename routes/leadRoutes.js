const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const sendEmail = require("../utils/sendEmail");


// ===============================
// POST - Create Lead
// ===============================
router.post("/", async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();

    // Non-blocking email
    sendEmail(req.body).catch(err => {
      console.error("Email error:", err);
    });

    res.status(201).json({ message: "Lead saved successfully" });

  } catch (error) {
    console.error("Main error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ===============================
// GET - Fetch All Leads
// ===============================
router.get("/", async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.status(200).json(leads);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});
// UPDATE LEAD STATUS
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// UPDATE LEAD STATUS
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// UPDATE LEAD (Deal Value or Status)
router.put("/:id", async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
