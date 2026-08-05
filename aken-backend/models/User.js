// PostgreSQL repository for the users table (was: Mongoose User model).
// API surface matches Mongoose: find/findById/findOne/create/updateOne/
// findByIdAndUpdate/exists/countDocuments + chainable query (+select/+lean/+sort)
const { createRepository } = require("./createRepository");

const User = createRepository({
  table: "users",
  fieldMap: {
    id: "_id",
    name: "name",
    email: "email",
    password_hash: "passwordHash",
    role: "role",
    last_login_at: "lastLoginAt",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  relations: {},
  subTables: {},
});

module.exports = User;
