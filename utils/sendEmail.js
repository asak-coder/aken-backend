const nodemailer = require("nodemailer");

const sendEmail = async (leadData) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"A K Engineering Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "🚀 New Enquiry Received",
      html: `
        <h2>New Lead Received</h2>
        <p><strong>Name:</strong> ${leadData.contactPerson}</p>
        <p><strong>Email:</strong> ${leadData.email}</p>
        <p><strong>Company:</strong> ${leadData.companyName}</p>
        <p><strong>Phone:</strong> ${leadData.phone}</p>
        <p><strong>Message:</strong> ${leadData.message}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("📩 Email sent successfully");
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
};

module.exports = sendEmail;
