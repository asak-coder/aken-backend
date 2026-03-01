const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();

const Quotation = require("../models/Quotation");
const Project = require("../models/Project");
const generatePDF = require("../utils/generateQuotationPDF");
const sendEmail = require("../utils/sendEmail");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const { log } = require("../utils/requestLogger");

router.post("/:id/convert", async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate("leadId");
    if (!quotation) {
      return sendError(res, req, {
        statusCode: 404,
        code: "QUOTATION_NOT_FOUND",
        message: "Quotation not found",
      });
    }

    const project = await Project.create({
      quotationId: quotation._id,
      projectName: `Project - ${quotation.quotationNumber || quotation._id}`,
      clientName:
        quotation.leadId?.companyName || req.body?.clientName || "Unknown Client",
      projectValue: quotation.totalAmount || 0,
    });

    quotation.status = "Approved";
    await quotation.save();

    return sendSuccess(res, req, project);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "QUOTATION_CONVERT_FAILED",
      message: "Unable to convert quotation to project.",
      err: error,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const quotation = await Quotation.create(req.body);

    const shouldGeneratePdf =
      String(process.env.QUOTATION_GENERATE_PDF || "true").toLowerCase() === "true";
    let pdfPath = null;

    if (shouldGeneratePdf) {
      const quotesDir = path.resolve(process.cwd(), "quotes");
      fs.mkdirSync(quotesDir, { recursive: true });
      pdfPath = path.join(quotesDir, `${quotation._id}.pdf`);
      generatePDF(quotation, pdfPath);
    }

    const clientEmail = req.body?.clientEmail;
    if (clientEmail && sendEmail.isEmailConfigured()) {
      try {
        const mailOptions = {
          to: clientEmail,
          subject: `Quotation ${quotation.quotationNumber || quotation._id}`,
          text: "Please find attached quotation.",
        };

        if (pdfPath) {
          mailOptions.attachments = [
            {
              filename: "quotation.pdf",
              path: pdfPath,
            },
          ];
        }

        await sendEmail(mailOptions);
      } catch (error) {
        log("error", req, "Quotation email delivery failed", {
          quotationId: String(quotation._id),
          errMessage: error.message,
        });
      }
    }

    return sendSuccess(res, req, quotation, 201);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "QUOTATION_CREATE_FAILED",
      message: "Unable to create quotation.",
      err: error,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const quotations = await Quotation.find().populate("leadId");
    return sendSuccess(res, req, quotations);
  } catch (error) {
    return sendError(res, req, {
      statusCode: 500,
      code: "QUOTATION_FETCH_FAILED",
      message: "Unable to fetch quotations.",
      err: error,
    });
  }
});

module.exports = router;
