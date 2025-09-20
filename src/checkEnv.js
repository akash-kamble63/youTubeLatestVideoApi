const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

console.log("DEBUG POSTGRES_URL:", process.env.POSTGRES_URL);