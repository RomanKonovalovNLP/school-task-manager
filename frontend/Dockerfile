# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

ARG REACT_APP_API_URL=/api

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .

ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Копируем собранный фронтенд
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx конфиг для SPA (все роуты → index.html)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /static { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
