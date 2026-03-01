const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    contactPerson: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
      match: /^[0-9+\-\s()]{7,20}$/,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Quoted", "Closed"],
      default: "New",
    },
    owner: {
      type: String,
      trim: true,
      default: "Unassigned",
      maxlength: 80,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ownerAssignedAt: {
      type: Date,
      default: null,
    },
    notes: [
      {
        text: {
          type: String,
          trim: true,
          maxlength: 2000,
        },
        addedBy: {
          type: String,
          trim: true,
          maxlength: 80,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    dealValue: {
      type: Number,
      min: 0,
    },
    probability: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

leadSchema.index({ ownerId: 1, status: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Lead", leadSchema);
