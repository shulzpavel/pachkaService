FROM node:20-alpine

WORKDIR /app

# Копируем shared модули
COPY shared ./shared
COPY services/router/package*.json ./
RUN npm ci --omit=dev

# Копируем код router
COPY services/router/*.js ./

# Создаём пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "index.js"]
