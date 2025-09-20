require('dotenv').config();
const sequelize = require('./db');
const Video = require('./models/Video');

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to PostgreSQL");

    await sequelize.sync({ force: true });
    console.log("✅ Video table synced");

    const video = await Video.create({
      youtubeId: "test123",
      title: "Test Video",
      description: "This is a test video",
      publishedAt: new Date(),
      thumbnails: { default: "http://example.com/thumb.jpg" },
    });
    console.log("✅ Inserted video:", video.toJSON());

    const videos = await Video.findAll();
    console.log("✅ Videos in DB:", videos.map(v => v.toJSON()));

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
