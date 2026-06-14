# Etapa 1: Build
FROM node:18-alpine AS builder

# 🔐 Declarar los argumentos que vienen del workflow
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_VALIDATION_PASSWORD

# 🧬 Exportarlos como variables de entorno si los necesitas en tiempo de ejecución
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_VALIDATION_PASSWORD=${NEXT_PUBLIC_VALIDATION_PASSWORD}

WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json ./
RUN npm ci

# Instalar herramientas de compilación (por si alguna dependencia lo requiere)
RUN apk add --no-cache python3 make g++

# Copiar el resto del código
COPY . .

# Compilar Next.js
RUN npm run build

# Etapa 2: Producción
FROM node:18-alpine AS runner

WORKDIR /app

# Copiar lo necesario desde la etapa builder
COPY --from=builder /app/package.json ./ 
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
