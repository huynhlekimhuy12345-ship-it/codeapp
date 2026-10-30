# syntax=docker/dockerfile:1
# Build frontend (Vite) -> frontend/dist
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Client ID Google được nhúng vào bản build frontend (truyền từ .env ở thư mục gốc
# qua docker-compose build args) — file frontend/.env không vào được Docker build.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Run backend (Express + mssql), serving frontend/dist on the same origin
FROM node:20-alpine AS app
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/
COPY --from=frontend-build /frontend/dist ./frontend/dist
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
CMD ["node", "backend/server.js"]
