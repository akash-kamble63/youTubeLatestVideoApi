require("./youtubePoller");  // starts background polling

const express = require("express");
const Video = require("./models/video");
const { Op } = require("sequelize");

const app = express();
app.use(express.json());

app.get("/videos", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const videos = await Video.findAll({
    order: [["publishedAt", "DESC"]],
    limit,
    offset,
  });

  res.json(videos);
});

app.get("/videos/search", async (req, res) => {
  const q = req.query.q || "";

  const videos = await Video.findAll({
    where: {
      [Op.or]: [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
      ],
    },
    order: [["publishedAt", "DESC"]],
  });

  res.json(videos);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
