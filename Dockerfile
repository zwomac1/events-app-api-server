# Use Official NodeJS base image
FROM node:16-alpine
RUN node -v
RUN npm -v
# Copy application code.
COPY . /app/
# Change the working directory in the image
WORKDIR /app
# Install dependencies.
RUN npm install
# Start the Express app
CMD ["node", "./src/server.js"]
