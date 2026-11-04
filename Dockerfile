# ==============================================================================
# Dockerfile para Hostinger VPS Plan KVM 2
# ==============================================================================
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Directorio persistente para base de datos JSON / archivos subidos
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
