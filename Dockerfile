# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy app source code
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose port (if your app has API endpoints, e.g. Express)
EXPOSE 3000

# Run the poller
CMD ["node", "src/fetchData.js"]
