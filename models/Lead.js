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
    utmSource: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    utmMedium: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    utmCampaign: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    utmTerm: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    utmContent: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    gclid: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    fbclid: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    msclkid: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    landingPage: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    referrerUrl: {
      type: String,
      trim: true,
      maxlength: 500,
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
    emailNotifications: {
      adminNotifiedAt: {
        type: Date,
        default: null,
      },
      clientAcknowledgedAt: {
        type: Date,
        default: null,
      },
      lastAttemptAt: {
        type: Date,
        default: null,
      },
      attemptCount: {
        type: Number,
        default: 0,
      },
      lastError: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },
    },
    whatsappNotifications: {
      adminNotifiedAt: {
        type: Date,
        default: null,
      },
      clientAcknowledgedAt: {
        type: Date,
        default: null,
      },
      lastAttemptAt: {
        type: Date,
        default: null,
      },
      attemptCount: {
        type: Number,
        default: 0,
      },
      lastError: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },
      lastFallbackUrl: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },
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
leadSchema.index({ utmSource: 1, utmCampaign: 1, createdAt: -1 });
leadSchema.index({ "emailNotifications.adminNotifiedAt": 1, createdAt: -1 });
leadSchema.index({ "whatsappNotifications.adminNotifiedAt": 1, createdAt: -1 });

module.exports = mongoose.model("Lead", leadSchema);
