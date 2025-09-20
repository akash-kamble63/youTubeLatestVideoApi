require("./fetchData");  // starts background polling

const express = require("express");
const Video = require("./models/video");
const { Op } = require("sequelize");

const app = express();
app.use(express.json());
/**
 * GET /videos
 * Fetches a paginated list of all videos ordered by published date (newest first)
 * Query parameters:
 *   - page: which page to fetch (default: 1)
 *   - limit: number of videos per page (default: 10)
 */
app.get("/videos", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit; // calculate how many records to skip

  const videos = await Video.findAll({
    order: [["publishedAt", "DESC"]],
    limit,
    offset,
  });

  res.json(videos);
});
/**
 * GET /videos/search
 * Search videos by keyword in title or description (case-insensitive)
 * Query parameters:
 *   - q: search keyword (required)
 */
app.get("/videos/search", async (req, res) => {
  const q = req.query.q || ""; // get search term

  // Fetch videos that match the search term in title or description
  const videos = await Video.findAll({
    where: {
      [Op.or]: [
        { title: { [Op.iLike]: `%${q}%` } },// title contains term
        { description: { [Op.iLike]: `%${q}%` } },// OR description contains term
      ],
    },
    order: [["publishedAt", "DESC"]],
  });

  res.json(videos);
});

const PORT = 3000;
// Start the Express server and log URL
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
