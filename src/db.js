const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

console.log("DEBUG POSTGRES_URL in db.js:", process.env.POSTGRES_URL);

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL is not defined. Check your .env file.");
}

const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.POSTGRES_URL, {
  dialect: "postgres",
});

module.exports = sequelize;
