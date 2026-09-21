# Stage 1: Build mã nguồn React
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Chạy web bằng Nginx
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html
# Xoá file mặc định của Nginx
RUN rm -rf ./*
# Copy file đã build từ Stage 1 sang Stage 2
COPY --from=builder /app/dist ./
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]