FROM node:20-alpine AS builder
WORKDIR /app
ARG REACT_APP_API_URL=/api
COPY package*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force
COPY . .
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV GENERATE_SOURCEMAP=false
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
