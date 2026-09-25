# Simple, single-stage image — this is a pure-JS backend (no native
# modules, no build step), so there's nothing to compile. Build this from
# inside backend/ (or with `docker build -f backend/Dockerfile backend`).

FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package.json
# actually changes.
COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

# Where the JSON "database" file lives — mount a volume here if you want
# the data to survive container restarts/redeploys (see DEPLOY.md).
VOLUME ["/app/data"]

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
