# youTubeLatestVideoApi
Fetch youtubes latest video details by category 

This project polls the YouTube Data API for the latest videos on a given search query and stores them in a **PostgreSQL** database.  
It is fully **Dockerized** and can be run with a single `docker-compose` command.

---

## Features
- Polls YouTube API at a configurable interval
- Automatically rotates API keys if quota is exceeded
- Stores videos in PostgreSQL using Sequelize ORM
- Stops fetching when no new videos are found
- Configurable poll interval, query, and window

---

# Database
- POSTGRES_USER=postgres
- POSTGRES_PASSWORD=admin
- POSTGRES_DB=youtube

---

## Environment Variables

Create a `.env` file in the project root:
```env

PORT=1234
POSTGRES_URL = abc
SEARCH_QUERY = abc
POLL_INTERVAL_MS = 12312 #in seconds
YT_API_KEYS = abc #if mutiple comma-separated for rotation
REDIS_URL=redis://redis:6379

```
---
## Example
- PORT=3000
- POSTGRES_URL=postgres://postgres:admin@localhost:5432/youtube
- SEARCH_QUERY=cricket
- POLL_INTERVAL_MS=10000   # 10 seconds
- YT_API_KEYS=abc,def,ghi
- REDIS_URL=redis://redis:6379
---

---
## To get the API Key 
[[YouTube data v3 API](https://developers.google.com/youtube/v3/getting-started "YouTube data v3 API")
---

## Running with Docker

***Build and start services:***
```
docker-compose up --build
```
***To stop***
```
docker-compose down
```

## Running without Docker

***Install dependencies***
```
npm install
```

***Run code***
```
node src/fetchData.js
```
---

## API Endpoints

***Get Latest Videos:***
```
http://localhost:<PORT-NUMBER>/videos #eg - http://localhost:3000/videos
```
***Get Video by ID:***
```
http://localhost:<PORT-NUMBER>/videos/abcd1234 
```
***Search Stored Videos:***
```
http://localhost:<PORT-NUMBER>/videos/search?query=highlights
```
---
