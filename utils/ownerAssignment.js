const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");

function normalizeOwner(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function buildOwnerPayload(user) {
  return {
    owner: user.name || user.email,
    ownerId: user._id,
    ownerAssignedAt: new Date(),
  };
}

async function findSalesUserByHint(ownerHint) {
  const hint = normalizeOwner(ownerHint);
  if (!hint) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(hint)) {
    const byId = await User.findOne({
      _id: hint,
      role: "sales",
    })
      .select("_id name email role")
      .lean();

    if (byId) {
      return byId;
    }
  }

  const byEmail = await User.findOne({
    email: { $regex: `^${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    role: "sales",
  })
    .select("_id name email role")
    .lean();

  if (byEmail) {
    return byEmail;
  }

  const byName = await User.findOne({
    name: { $regex: `^${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    role: "sales",
  })
    .select("_id name email role")
    .lean();

  return byName || null;
}

async function findLeastLoadedSalesUser() {
  const salesUsers = await User.find({ role: "sales" })
    .select("_id name email")
    .lean();

  if (salesUsers.length === 0) {
    return null;
  }

  const salesUserIds = salesUsers.map((user) => user._id);
  const openLeadCounts = await Lead.aggregate([
    {
      $match: {
        ownerId: { $in: salesUserIds },
        status: { $ne: "Closed" },
      },
    },
    {
      $group: {
        _id: "$ownerId",
        count: { $sum: 1 },
      },
    },
  ]);

  const countByUserId = new Map(
    openLeadCounts.map((item) => [String(item._id), item.count]),
  );

  const sortedCandidates = salesUsers
    .map((user) => ({
      ...user,
      openLeadCount: countByUserId.get(String(user._id)) || 0,
    }))
    .sort((a, b) => {
      if (a.openLeadCount !== b.openLeadCount) {
        return a.openLeadCount - b.openLeadCount;
      }

      return (a.name || a.email || "").localeCompare(b.name || b.email || "");
    });

  return sortedCandidates[0] || null;
}

async function resolveLeadOwnerAssignment(ownerHint) {
  const normalizedHint = normalizeOwner(ownerHint);

  if (normalizedHint && normalizedHint.toLowerCase() === "unassigned") {
    return {
      owner: "Unassigned",
      ownerId: null,
      ownerAssignedAt: null,
    };
  }

  if (normalizedHint) {
    const requestedUser = await findSalesUserByHint(normalizedHint);

    if (!requestedUser) {
      const error = new Error(
        "Requested owner is invalid. Provide a valid sales user id, email, or name.",
      );
      error.statusCode = 400;
      throw error;
    }

    return buildOwnerPayload(requestedUser);
  }

  const autoUser = await findLeastLoadedSalesUser();

  if (!autoUser) {
    return {
      owner: "Unassigned",
      ownerId: null,
      ownerAssignedAt: null,
    };
  }

  return buildOwnerPayload(autoUser);
}

module.exports = {
  resolveLeadOwnerAssignment,
};
