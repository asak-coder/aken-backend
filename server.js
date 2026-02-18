const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const leadRoutes = require("./routes/leadRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(cors({
  origin: [
    "https://aken.firm.in",
    "https://www.aken.firm.in",
    "https://aken-frontend.vercel.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: false
}));
app.options("*", cors());

app.use("/api/leads", leadRoutes);




// Test route
app.get("/", (req, res) => {
  res.send("Aken Backend API Running");
});

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// IMPORTANT: Render requires this
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
