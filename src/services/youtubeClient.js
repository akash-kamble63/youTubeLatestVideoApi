const axios = require('axios');
require('dotenv').config();

const keys = (process.env.YT_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

let keyIndex = 0;
if (keys.length === 0) throw new Error("Provide YT_API_KEYS env");

// Fetch videos from YouTube
async function fetchVideosForQuery(query, pageToken = null, maxResults = 10, publishedAfter = null) {
  const base = 'https://www.googleapis.com/youtube/v3/search';
  const params = {
    part: 'snippet',
    q: query,
    order: 'date',
    type: 'video',
    maxResults,
    key: keys[keyIndex],
  };

  if (pageToken) params.pageToken = pageToken;
  if (publishedAfter) params.publishedAfter = publishedAfter;

  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (retryCount <= MAX_RETRIES) {
    try {
      const resp = await axios.get(base, { params });
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      if ((status === 403 || status === 429) && keys.length > 1) {
        keyIndex = (keyIndex + 1) % keys.length;
        console.warn(`Key rotated to index ${keyIndex} due to ${status}`);
        params.key = keys[keyIndex];
        retryCount++;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount))); // exponential backoff
        continue;
      }
      throw err;
    }
  }

  throw new Error('Max retries exceeded for YouTube API');
}

module.exports = { fetchVideosForQuery };
