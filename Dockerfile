FROM node:26-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV PACKET_STORAGE=convex

EXPOSE 8787

CMD ["node", "src/cli.js", "server"]
