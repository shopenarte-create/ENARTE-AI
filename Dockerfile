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

# Build ENARTE mobile web (Expo static) → public/app
ARG EXPO_PUBLIC_API_BASE_URL=https://enarte-ai-production.up.railway.app
ARG EXPO_PUBLIC_STORE_URL=https://enarteshop.com
ARG EXPO_PUBLIC_SHOP_DOMAIN=jb8xus-wn.myshopify.com
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL \
    EXPO_PUBLIC_STORE_URL=$EXPO_PUBLIC_STORE_URL \
    EXPO_PUBLIC_SHOP_DOMAIN=$EXPO_PUBLIC_SHOP_DOMAIN
WORKDIR /app/mobile
RUN npm ci && npx expo export -p web --output-dir ../public/app
WORKDIR /app

RUN npx prisma generate && npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]
