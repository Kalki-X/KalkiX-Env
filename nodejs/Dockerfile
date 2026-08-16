# GearShare API — production image for Render (or any Docker host).
# Local Docker Compose development does NOT use this file; it bind-mounts
# nodejs/ directly and runs `npm run dev` (nodemon) instead. This Dockerfile
# is only for the deployed/demo environment.

FROM node:22-alpine AS production
WORKDIR /usr/src/app

# Install dependencies first so this layer is cached unless package*.json changes.
# --omit=dev excludes nodemon (devDependencies), keeping the image lean.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Now bring in the application source. All uploads (avatars, item images,
# logos, PDFs) are stored as bytea rows in Postgres rather than on local disk
# (see schema.sql), so no writable local directory needs to be created here —
# the app never writes to its own filesystem at runtime.
COPY . .
RUN chown -R node:node /usr/src/app

# Run as the non-root `node` user baked into the official image instead of root.
USER node

ENV NODE_ENV=production
# Render injects its own PORT at runtime (the app reads process.env.PORT with a
# fallback of 3000); EXPOSE here is documentation, not a hard requirement.
EXPOSE 3000

# index.js already runs schema migration + super-admin bootstrap before
# listening, so no separate migration step is needed here.
CMD ["node", "index.js"]
