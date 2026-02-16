const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");


router.post("/", async (req, res) => {
  console.log("BODY RECEIVED:", req.body);
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.status(201).json({ message: "Lead created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;

