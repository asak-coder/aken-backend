const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const leadRoutes = require("./routes/leadRoutes");

const app = express();

app.use(cors());            // ✅ SIMPLE & CORRECT
app.use(express.json());

app.use("/api/leads", leadRoutes);

app.get("/", (req, res) => {
  res.send("Aken Backend API Running");
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
