const express = require('express');
const router = express.Router();
const Video = require('../models/video');
const { Op } = require('sequelize');
const redis = require('redis');

// ------------------- Redis Setup -------------------
const redisClient = redis.createClient();
redisClient.on('error', (err) => console.error('Redis error:', err));

(async () => await redisClient.connect())()
  .then(() => console.log('Connected to Redis'))
  .catch(console.error);

// ------------------- Cache Middleware -------------------
async function cache(req, res, next) {
  const key = req.originalUrl; // use URL as cache key
  try {
    // Try to fetch cached data from Redis
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      // Cache found send the cached response and skip the route handler
      console.log('Cache hit:', key);
      return res.json(JSON.parse(cachedData));
    }
    // Cache not found proceed to the route handler
    console.log('Cache miss:', key);

    // override res.json to cache response
    res.sendResponse = res.json;
    res.json = (data) => {
      // Store the response in Redis for 60 seconds
      redisClient.setEx(key, 60, JSON.stringify(data)); 
      res.sendResponse(data); // Send the actual response to the client
    };
    // Continue to the next route handler
    next();
  } catch (err) {
    console.error('Redis cache error:', err);
    next();
  }
}

// ------------------- Routes -------------------

// GET /videos?page=&limit=
router.get('/videos', cache, async (req, res) => {
  // Parse query parameters for pagination
  const page = Math.max(1, parseInt(req.query.page || '1', 10));// default page = 1
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10));// default limit = 10, max = 100
  const offset = (page - 1) * limit; // calculate offset for SQL query

  // Fetch videos from database with pagination
  const { rows, count } = await Video.findAndCountAll({
    order: [['publishedAt', 'DESC']],// newest videos first
    limit,
    offset,
  });
  //send the response 
  res.json({ page, limit, total: count, items: rows });//current page, item per page , total items, array of videositems
});

// GET /search?q=&page=&limit=
router.get('/search', cache, async (req, res) => {
  // Get the search query from URL parameter and trim whitespace
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ message: 'q required' });//return if empty

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
  const offset = (page - 1) * limit;

   // Split query into tokens (words) to support fuzzy partial match
  const tokens = q.split(/\s+/).map((t) => `%${t}%`);

  // Build Sequelize 'where' condition to search title OR description
  // Each token must match either title or description
  const where = {
    [Op.and]: tokens.map((t) => ({
      [Op.or]: [
        { title: { [Op.iLike]: t } },
        { description: { [Op.iLike]: t } },
      ],
    })),
  };
  // Query database with pagination and sorting by publishedAt and in descending order
  const { rows, count } = await Video.findAndCountAll({
    where,
    order: [['publishedAt', 'DESC']],// newest videos first
    limit,
    offset,
  });
  //return the response
  res.json({ page, limit, total: count, items: rows });//current page, item per page , total items, array of videositems
});

module.exports = router;
