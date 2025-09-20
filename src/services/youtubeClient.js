const axios = require('axios');
require('dotenv').config();

const keys = (process.env.YT_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

let keyIndex = 0;
if (keys.length === 0) throw new Error("Provide YT_API_KEYS env");

// Fetch videos from YouTube
/**
 * 
 * @param {*} query The search term or keyword you want to fetch videos for.
 * @param {*} pageToken Used for pagination.
 * @param {*} maxResults Number of videos to fetch in a single API call.
 * @param {*} publishedAfter Fetch videos published after this date.
 * @returns // current API key from list
 */
async function fetchVideosForQuery(query, pageToken = null, maxResults = 10, publishedAfter = null) {
  const base = 'https://www.googleapis.com/youtube/v3/search';
  const params = {
    part: 'snippet',//Only fetches the snippet section of the video, which includes:title,description,published date,thumbnails,channel info
    q: query,
    order: 'date',
    type: 'video',
    maxResults,
    key: keys[keyIndex],
  };
  //for pagination
  if (pageToken) params.pageToken = pageToken;
  //filter that tells YouTube to return only videos published after a certain time
  if (publishedAfter) params.publishedAfter = publishedAfter;

  let retryCount = 0;
  const MAX_RETRIES = 3;
/**
 * To fetch data from the YouTube API (axios.get) while handling:
     - Quota exceeded errors (403)
     - Too many requests (429)
   To rotate through multiple API keys if one is exhausted.
   To retry requests with exponential backoff instead of failing immediately.
 */
  while (retryCount <= MAX_RETRIES) {
    try {
      // Attempt to make a request to the YouTube API
      const resp = await axios.get(base, { params });
      // If successful, return the response data
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      // If the request was blocked (403: quota exceeded or 429: too many requests)
      // and we have multiple API keys to rotate through
      if ((status === 403 || status === 429) && keys.length > 1) {
        // Rotate to the next API key
        keyIndex = (keyIndex + 1) % keys.length;
        console.warn(`Key rotated to index ${keyIndex} due to ${status}`);
        // Update the request params to use the new key
        params.key = keys[keyIndex];
         // Increment retry counter
        retryCount++;
        // Wait before retrying
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount)));
        // Continue the loop and try the request again with the new key
        // For any other error or if all keys fail, throw the error
        continue;
      }
      throw err;
    }
  }

  throw new Error('Max retries exceeded for YouTube API');
}

module.exports = { fetchVideosForQuery };
