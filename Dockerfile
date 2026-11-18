# ─── Etapa 1: Build ───
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar NestJS
COPY . .
RUN npm run build

# ─── Etapa 2: Runner de Producción ───
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar artefactos compilados desde el builder
COPY --from=builder /app/dist ./dist

# Exponer puerto del backend
EXPOSE 3000

# Comando de arranque
CMD ["node", "dist/main.js"]
