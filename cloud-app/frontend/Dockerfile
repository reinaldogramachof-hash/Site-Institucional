# Use Nginx to serve static files
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy local site content to Nginx folder
# This assumes the build context is the project root, not cloud-app/frontend
# We will instruct user to build from root: "docker build -f cloud-app/frontend/Dockerfile ."
COPY . /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
