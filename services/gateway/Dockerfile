FROM node:20-alpine

WORKDIR /app

# Копируем shared package и ставим зависимости
COPY shared/package*.json ./shared/
RUN cd shared && npm ci --omit=dev

# Копируем shared код
COPY shared ./shared

# Устанавливаем зависимости gateway
WORKDIR /app/services/gateway
COPY services/gateway/package*.json ./
RUN npm ci --omit=dev

# Копируем код gateway (оставляем относительные пути вида ../../shared)
COPY services/gateway/*.js ./

# Создаём пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "index.js"]
