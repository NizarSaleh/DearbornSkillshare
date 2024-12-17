# Frontend Dockerfile
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the React source code
COPY . .

# Build the React app
RUN npm run build

# Install a lightweight HTTP server to serve the build
RUN npm install -g serve

# Expose the frontend port
EXPOSE 3000

# Serve the React build
CMD ["serve", "-s", "build"]
