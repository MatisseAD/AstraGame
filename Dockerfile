FROM node:22-alpine
WORKDIR /app
# The realtime service only needs ws, not the Next.js build.
RUN npm init -y && npm install --omit=dev --save-exact ws@8.22.0
COPY game ./game
COPY server ./server
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node","server/index.mjs"]
