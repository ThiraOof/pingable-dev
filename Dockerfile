# Stage 1: build the Web Component bundle (esbuild is a devDependency)
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY scripts ./scripts
COPY src ./src
RUN npm run build

# Stage 2: production image — runtime deps only
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY --from=build /app/src/public/js/bundle.js ./src/public/js/bundle.js
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "src/server.js"]
