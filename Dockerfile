# Build the React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY frontend/ ./
RUN npm run build

# Run the Node backend and serve the React build
FROM node:22-alpine AS app
ENV NODE_ENV=production
WORKDIR /app

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi --omit=dev

COPY backend/ /app/backend/
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 5000
CMD ["npm", "start"]
