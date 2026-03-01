const express = require("express");
const router = express.Router();
const Quotation = require("../models/Quotation");
const generatePDF = require("../utils/generateQuotationPDF");
const sendEmail = require("../utils/sendEmail");
const Project = require("../models/Project");

router.post("/:id/convert", async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);

  if (!quotation)
    return res.status(404).json({ error: "Quotation not found" });

  const project = await Project.create({
    quotationId: quotation._id,
    projectName: `Project - ${quotation.quotationNumber}`,
    clientName: quotation.leadId?.companyName,
    projectValue: quotation.totalAmount,
  });

  quotation.status = "Approved";
  await quotation.save();

  res.json(project);
});
router.post("/", async (req, res) => {
  const quotation = await Quotation.create(req.body);

  const pdfPath = `./quotes/${quotation._id}.pdf`;

  generatePDF(quotation, pdfPath);

  await sendEmail({
    to: req.body.clientEmail,
    subject: `Quotation ${quotation.quotationNumber}`,
    text: "Please find attached quotation.",
    attachments: [
      {
        filename: "quotation.pdf",
        path: pdfPath,
      },
    ],
  });

  res.status(201).json(quotation);
});
router.post("/", async (req, res) => {
  const quotation = await Quotation.create(req.body);

  generatePDF(quotation, `./quotes/${quotation._id}.pdf`);

  res.status(201).json(quotation);
});
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