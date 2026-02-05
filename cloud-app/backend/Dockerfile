# Use official Node.js runtime
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .

# Expose port (Cloud Run sets PORT env var, defaults to 8080)
EXPOSE 8080

# Command to run
CMD [ "node", "index.js" ]
