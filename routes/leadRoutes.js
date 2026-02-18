const sendEmail = require("../utils/sendEmail");
const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");


router.post("/", async (req, res) => {
  console.log("BODY RECEIVED:", req.body);

  try {
    const lead = new Lead(req.body);
    await lead.save();

    // 🔥 Make email non-blocking
    sendEmail(req.body).catch(err => {
      console.error("Email error:", err);
    });

    res.status(201).json({ message: "Lead saved successfully" });

  } catch (error) {
    console.error("Main error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

