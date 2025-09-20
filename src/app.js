require('dotenv').config();
const express = require('express');
const app = express();
const sequelize = require('./db');
const videosRouter = require('./routes/videos');

app.use(express.json());
app.use('/api', videosRouter);

app.get('/', (req, res) => res.send('YouTube Poller API'));

module.exports = app;
