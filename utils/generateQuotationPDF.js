const PDFDocument = require("pdfkit");

function safeText(value, maxLen = 500) {
  const raw = typeof value === "string" ? value : String(value ?? "");
  // Remove control chars that can mess with PDF rendering/logging
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!cleaned) return "-";
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function generateQuotationPDF(quotation) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("A K ENGINEERING", { align: "center" });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Quotation No: ${safeText(quotation?.quotationNumber, 64)}`);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`);
    doc.moveDown();

    const items = Array.isArray(quotation?.items) ? quotation.items.slice(0, 200) : [];
    items.forEach((item, index) => {
      const line = `${index + 1}. ${safeText(item?.description, 500)} - Qty: ${safeNumber(
        item?.quantity,
        0,
      )} × ₹${safeNumber(item?.rate, 0)} = ₹${safeNumber(item?.amount, 0)} `;

      doc.text(line);
    });

    doc.moveDown();
    doc.text(`Subtotal: ₹${safeNumber(quotation?.subtotal, 0)}`);
    doc.text(`GST: ₹${safeNumber(quotation?.gst, 0)}`);
    doc.text(`Total: ₹${safeNumber(quotation?.totalAmount, 0)}`);

    doc.end();
  });
}

module.exports = generateQuotationPDF;
