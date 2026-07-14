FROM node:22-alpine
RUN apk add --no-cache openssl libc6-compat

EXPOSE 3000
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN npx prisma generate && npm run build

CMD ["npm", "run", "docker-start"]
