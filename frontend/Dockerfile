FROM node:20-alpine AS builder
WORKDIR /app
ARG REACT_APP_API_URL=/api
ARG REACT_APP_WS_URL=
COPY package*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force
COPY . .
ENV REACT_APP_API_URL=$REACT_APP_API_URL
# Адрес для WebSocket-уведомлений: без него сборка уходит на localhost
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL
# Сборка CRA требовательна к памяти: 512 МБ перестало хватать после роста
# приложения (падало с «JavaScript heap out of memory»).
# 2 ГБ покрывают текущий объём; на сервере при нехватке ОЗУ добирается из swap.
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV GENERATE_SOURCEMAP=false
# Отключаем интерактивный вывод и предупреждения как ошибки — в CI они не нужны
ENV CI=false
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
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
