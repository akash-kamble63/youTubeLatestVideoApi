// Load environment variables from .env
require('dotenv').config();

// Import Sequelize DB instance and Video model
const sequelize = require('./db');
const Video = require('./models/video');

// Import YouTube API service function
const { fetchVideosForQuery } = require('./services/youtubeClient');

// Configurable constants
const QUERY = process.env.SEARCH_QUERY || 'official'; // search term
const INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '1800000', 10); // default 30 min
// fetch recent N days
const POLL_WINDOW_DAYS = parseInt(process.env.POLL_WINDOW_DAYS || '30', 10);
// limit max pages per poll 
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '5', 10); 

// Bulk upsert videos into DB
async function bulkUpsertVideos(items) {
  // Map raw API items to Video model data
  const bulkData = items.map(item => ({
    youtubeId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnails: item.snippet.thumbnails,
    raw: item,
  }));

  if (bulkData.length === 0) return 0; 

  // Bulk insert or update existing videos (updateOnDuplicate ensures updates)
  const result = await Video.bulkCreate(bulkData, {
    updateOnDuplicate: ['title', 'description', 'publishedAt', 'thumbnails', 'raw'],
  });

  return result.length; // number of records inserted
}

// Fetch all videos from YouTube API
async function fetchAllVideos(query) {

  // Step 1: find the latest video in DB
  const latestVideo = await Video.findOne({
    order: [['publishedAt', 'DESC']],
  });

  // Step 2: determine publishedAfter to avoid fetching old videos
  const publishedAfter = latestVideo
    ? new Date(latestVideo.publishedAt).toISOString()
    : new Date(Date.now() - POLL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(); // fallback 30 days

  let pageToken = null; // for pagination
  let totalFetched = 0; // total videos fetched
  let pageCount = 0; // pages fetched
  let newVideosFound = false; // flag to stop early if no new videos

  while (true) {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      console.log('Reached max pages, stopping.');
      break; // avoid too many API calls
    }

    // Fetch videos from YouTube API
    const res = await fetchVideosForQuery(query, pageToken, 10, publishedAfter);
    if (!res || !res.items || res.items.length === 0) break;

    // Insert fetched videos in bulk
    const insertedCount = await bulkUpsertVideos(res.items);
    if (insertedCount > 0) newVideosFound = true;

    totalFetched += res.items.length;
    console.log(`Fetched ${res.items.length} items (total ${totalFetched}), inserted ${insertedCount} new`);

    // Stop early if no new videos found
    if (!newVideosFound) {
      console.log('No new videos, stopping early.');
      break;
    }

    // Stop if no next page token
    if (!res.nextPageToken) break;
    // continue to next page
    pageToken = res.nextPageToken; 
  }
}

// Polling function to repeatedly fetch videos
async function poll() {
  try {
    console.log(`Polling for query "${QUERY}"...`);
    await fetchAllVideos(QUERY);
  } catch (e) {
    if (e.response && e.response.data) {
      // Handle YouTube API errors
      console.error('YouTube API Error:', JSON.stringify(e.response.data, null, 2));
    } else {
      console.error('Poll error:', e.message || e);
    }
  }
}

// Main entry point
(async () => {
  await sequelize.authenticate(); // connect to DB
  await sequelize.sync(); // sync models (dev only)
  console.log('Poller started. Query:', QUERY, 'Interval:', INTERVAL_MS);

  // Continuous polling loop
  setInterval(poll, INTERVAL_MS);

  // Run once immediately to fetch data right away
  poll();
})();
