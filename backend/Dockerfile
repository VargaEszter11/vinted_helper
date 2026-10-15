# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend/src ./src
RUN mkdir -p /app/uploads && chown node:node /app/uploads
ENV PHOTO_DIR=/app/uploads
VOLUME /app/uploads
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
