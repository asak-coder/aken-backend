const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const sendEmail = require("../utils/sendEmail");
const {
  validateCreateLead,
  validateLeadStatusUpdate,
  validateLeadUpdate,
  validateLeadOwnerUpdate,
} = require("../middleware/leadValidation");
const {
  leadCreateLimiter,
  leadMutationLimiter,
} = require("../middleware/rateLimiters");
const {
  resolveLeadOwnerAssignment,
} = require("../utils/ownerAssignment");

// ===============================
// POST - Create Lead
// ===============================
router.post("/", leadCreateLimiter, validateCreateLead, async (req, res) => {
  try {
    const ownerAssignment = await resolveLeadOwnerAssignment(
      req.validatedLead.owner,
    );
    const leadPayload = {
      ...req.validatedLead,
      ...ownerAssignment,
    };

    const lead = new Lead(leadPayload);
    await lead.save();

    // Non-blocking email
    sendEmail({
      ...req.validatedLead,
      owner: lead.owner,
    }).catch(err => {
      console.error("Email error:", err);
    });

    res.status(201).json({
      message: "Lead saved successfully",
      leadId: lead._id,
      owner: lead.owner,
      ownerId: lead.ownerId,
    });

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
// CANONICAL: UPDATE LEAD STATUS
router.put("/:id/status", leadMutationLimiter, validateLeadStatusUpdate, async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status: req.validatedStatus },
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// CANONICAL: UPDATE LEAD OWNER
router.put("/:id/owner", leadMutationLimiter, validateLeadOwnerUpdate, async (req, res) => {
  try {
    const ownerAssignment = await resolveLeadOwnerAssignment(req.validatedOwner);
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      ownerAssignment,
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Internal server error",
    });
  }
});
// UPDATE LEAD DETAILS (status is intentionally excluded)
router.put("/:id", leadMutationLimiter, validateLeadUpdate, async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.validatedLeadUpdate,
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/:id/notes", async (req, res) => {
  const { text } = req.body;

  const lead = await Lead.findById(req.params.id);

  lead.notes.push({
    text,
    addedBy: req.user.id
  });

  await lead.save();

  res.json({ message: "Note added" });
});
router.get("/client/:quotationNumber", async (req, res) => {
  const quotation = await Quotation.findOne({
    quotationNumber: req.params.quotationNumber,
  });

  res.json(quotation);
});

module.exports = router;
