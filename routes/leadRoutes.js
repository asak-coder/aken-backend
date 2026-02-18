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


module.exports = router;
