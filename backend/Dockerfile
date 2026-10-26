FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY migrations ./migrations
RUN chown -R node:node /app
USER node
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
