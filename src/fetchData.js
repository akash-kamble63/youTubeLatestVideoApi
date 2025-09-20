// Load environment variables
require('dotenv').config();

const sequelize = require('./db');
const Video = require('./models/video');
const { fetchVideosForQuery } = require('./services/youtubeClient');
const redis = require('redis');

// Config
const QUERY = process.env.SEARCH_QUERY || 'official';
const INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '1800000', 10); // default 30 min
const POLL_WINDOW_DAYS = parseInt(process.env.POLL_WINDOW_DAYS || '30', 10);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '5', 10);

// Create Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});
redisClient.on('error', (err) => console.error('Redis error:', err));
(async () => await redisClient.connect())();

// Bulk upsert videos into DB
async function bulkUpsertVideos(items) {
  const bulkData = items.map(item => ({
    youtubeId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnails: item.snippet.thumbnails,
    raw: item,
  }));

  if (bulkData.length === 0) return 0;

  const result = await Video.bulkCreate(bulkData, {
    updateOnDuplicate: ['title', 'description', 'publishedAt', 'thumbnails', 'raw'],
  });

  return result.length;
}

// Update Redis cache for latest videos
async function updateRedisCache() {
  const latestVideos = await Video.findAll({
    order: [['publishedAt', 'DESC']],
    limit: 50, // cache top 50 videos
  });
  await redisClient.setEx('latest_videos', 300, JSON.stringify(latestVideos)); // 5 min expiry
}

// Fetch all videos from YouTube API
async function fetchAllVideos(query) {
  const latestVideo = await Video.findOne({
    order: [['publishedAt', 'DESC']],
  });

  const publishedAfter = latestVideo
    ? new Date(latestVideo.publishedAt).toISOString()
    : new Date(Date.now() - POLL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let pageToken = null;
  let totalFetched = 0;
  let pageCount = 0;
  let newVideosFound = false;

  while (true) {
    pageCount++;
    if (pageCount > MAX_PAGES) break;

    const res = await fetchVideosForQuery(query, pageToken, 10, publishedAfter);
    if (!res || !res.items || res.items.length === 0) break;

    const insertedCount = await bulkUpsertVideos(res.items);
    if (insertedCount > 0) newVideosFound = true;

    // Update Redis cache if new videos found
    if (insertedCount > 0) {
      await updateRedisCache();
    }

    totalFetched += res.items.length;
    console.log(`Fetched ${res.items.length} items (total ${totalFetched}), inserted ${insertedCount} new`);

    if (!newVideosFound) break;
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
}

// Polling function
async function poll() {
  try {
    console.log(`Polling for query "${QUERY}"...`);
    await fetchAllVideos(QUERY);
  } catch (e) {
    if (e.response && e.response.data) {
      console.error('YouTube API Error:', JSON.stringify(e.response.data, null, 2));
    } else {
      console.error('Poll error:', e.message || e);
    }
  }
}

// Main
(async () => {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Poller started. Query:', QUERY, 'Interval:', INTERVAL_MS);

  // Continuous polling
  setInterval(poll, INTERVAL_MS);
  poll();
})();
