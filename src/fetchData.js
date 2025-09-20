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

  // Determine the "publishedAfter" timestamp to fetch only recent videos
  const publishedAfter = latestVideo
    ?// If we already have a latest video in the database,
    // use its published date as the starting point to fetch only newer videos 
    new Date(latestVideo.publishedAt).toISOString()
    : // If no videos exist in the DB yet,
      // fallback to fetching videos from the last POLL_WINDOW_DAYS days
    new Date(Date.now() - POLL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let pageToken = null;
  let totalFetched = 0;
  let pageCount = 0;
  let newVideosFound = false;

  /**
   * Fetches videos from YouTube page by page.
    Stops after MAX_PAGES or if no more new videos are found.
    Inserts videos into the database.
    Updates Redis cache if new videos are added.
    Handles pagination and prevents overloading the API.
   */

  // Continuous loop to fetch videos page by page
  while (true) {

    // Increment the current page counter
    pageCount++;

    // Stop fetching if we've reached the maximum allowed pages
    if (pageCount > MAX_PAGES) break;


    // Fetch a page of videos from YouTube API
    const res = await fetchVideosForQuery(query, pageToken, 10, publishedAfter);

    // Stop if API returned no results or empty data
    if (!res || !res.items || res.items.length === 0) break;


    // Insert the fetched videos into the database in bulk
    // `bulkUpsertVideos` will insert new videos or update existing ones
    const insertedCount = await bulkUpsertVideos(res.items);
    if (insertedCount > 0) newVideosFound = true;

    // Update Redis cache if new videos found
    // If new videos are added, update Redis cache to reflect latest data
    if (insertedCount > 0) {
      await updateRedisCache();
    }

    // Keep track of total videos fetched so far
    totalFetched += res.items.length;
    
    // Log progress
    console.log(`Fetched ${res.items.length} items (total ${totalFetched}), inserted ${insertedCount} new`);

     // Stop fetching if no new videos were found in this page
    if (!newVideosFound) break;
    // Stop fetching if there is no next page token from YouTube API
    if (!res.nextPageToken) break;
    // Set pageToken for the next iteration to fetch the next page
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
