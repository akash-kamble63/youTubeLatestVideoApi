const express = require('express');
const router = express.Router();
const Video = require('../models/video');
const { Op, literal } = require('sequelize');

/** GET /videos?page=&limit= */
router.get('/videos', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
  const offset = (page - 1) * limit;

  const { rows, count } = await Video.findAndCountAll({
    order: [['publishedAt', 'DESC']],
    limit,
    offset
  });
  res.json({ page, limit, total: count, items: rows });
});

/** GET /search?q=&page=&limit= — fuzzy partial match */
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ message: 'q required' });

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
  const offset = (page - 1) * limit;

  // Simple approach: use ILIKE for tokens; or use pg_trgm similarity
  const tokens = q.split(/\s+/).map(t => `%${t}%`);

  const where = {
    [Op.and]: tokens.map(t => ({
      [Op.or]: [
        { title: { [Op.iLike]: t } },
        { description: { [Op.iLike]: t } }
      ]
    }))
  };

  const { rows, count } = await Video.findAndCountAll({
    where,
    order: [['publishedAt', 'DESC']],
    limit,
    offset
  });

  res.json({ page, limit, total: count, items: rows });
});

module.exports = router;
