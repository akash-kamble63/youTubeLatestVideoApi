const express = require('express');
const router = express.Router();
const Video = require('../models/video');
const { Op } = require('sequelize');
const redis = require('redis');

// ------------------- Redis Setup -------------------
const redisClient = redis.createClient();
redisClient.on('error', (err) => console.error('Redis error:', err));

(async () => await redisClient.connect())()
  .then(() => console.log('✅ Connected to Redis'))
  .catch(console.error);

// ------------------- Cache Middleware -------------------
async function cache(req, res, next) {
  const key = req.originalUrl; // use URL as cache key
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      console.log('⚡ Cache hit:', key);
      return res.json(JSON.parse(cachedData));
    }
    console.log('❌ Cache miss:', key);
    // override res.json to cache response
    res.sendResponse = res.json;
    res.json = (data) => {
      redisClient.setEx(key, 60, JSON.stringify(data)); // cache for 60 seconds
      res.sendResponse(data);
    };
    next();
  } catch (err) {
    console.error('Redis cache error:', err);
    next();
  }
}

// ------------------- Routes -------------------

// GET /videos?page=&limit=
router.get('/videos', cache, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
  const offset = (page - 1) * limit;

  const { rows, count } = await Video.findAndCountAll({
    order: [['publishedAt', 'DESC']],
    limit,
    offset,
  });

  res.json({ page, limit, total: count, items: rows });
});

// GET /search?q=&page=&limit=
router.get('/search', cache, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ message: 'q required' });

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
  const offset = (page - 1) * limit;

  const tokens = q.split(/\s+/).map((t) => `%${t}%`);

  const where = {
    [Op.and]: tokens.map((t) => ({
      [Op.or]: [
        { title: { [Op.iLike]: t } },
        { description: { [Op.iLike]: t } },
      ],
    })),
  };

  const { rows, count } = await Video.findAndCountAll({
    where,
    order: [['publishedAt', 'DESC']],
    limit,
    offset,
  });

  res.json({ page, limit, total: count, items: rows });
});

module.exports = router;
