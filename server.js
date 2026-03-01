require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();   // 👈 CREATE APP FIRST

// Middleware
app.use(helmet());       // 👈 THEN use it
app.use(cors());
app.use(express.json());
app.use(morgan("combined"));

// Routes
const leadRoutes = require("./routes/leadRoutes");
const quotationRoutes = require("./routes/quotationRoutes");

app.use("/api/leads", leadRoutes);
app.use("/api/quotations", quotationRoutes);

// Port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});