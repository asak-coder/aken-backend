const PDFDocument = require("pdfkit");
const fs = require("fs");

function generateQuotationPDF(quotation, filePath) {
  const doc = new PDFDocument();

  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).text("A K ENGINEERING", { align: "center" });
  doc.moveDown();
  doc.text(`Quotation No: ${quotation.quotationNumber}`);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  quotation.items.forEach((item, index) => {
    doc.text(
      `${index + 1}. ${item.description} - Qty: ${item.quantity} × ₹${item.rate} = ₹${item.amount}`
    );
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹${quotation.subtotal}`);
  doc.text(`GST: ₹${quotation.gst}`);
  doc.text(`Total: ₹${quotation.totalAmount}`, { bold: true });

  doc.end();
}

module.exports = generateQuotationPDF;