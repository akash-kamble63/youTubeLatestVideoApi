const { DataTypes } = require('sequelize');
const sequelize = require('../db');


const Video = sequelize.define('Video', {
  youtubeId: { type: DataTypes.STRING, unique: true, allowNull: false },
  title: { type: DataTypes.TEXT },
  description: { type: DataTypes.TEXT },
  publishedAt: { type: DataTypes.DATE },
  thumbnails: { type: DataTypes.JSONB }, // store all thumbnail URLs
  raw: { type: DataTypes.JSONB }, // store the entire API response for future proofing/flexibility/debugging/backup
}, {
  indexes: [
    { fields: ['publishedAt'] },
    { fields: ['youtubeId'], unique: true }
  ],
  timestamps: true,
});

module.exports = Video;