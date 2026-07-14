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
RUN npx prisma generate && npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]
