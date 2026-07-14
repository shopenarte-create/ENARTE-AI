FROM node:22-alpine
RUN apk add --no-cache openssl libc6-compat

EXPOSE 3000
WORKDIR /app

ENV PORT=3000

# Install with devDependencies (vite) — NODE_ENV=production would skip them.
COPY package.json package-lock.json* ./
COPY extensions ./extensions
RUN npm ci

COPY . .

# Prisma config requires DATABASE_URL at generate/build time.
# Runtime URL comes from Railway Postgres; this is only a build placeholder.
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate && npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]
