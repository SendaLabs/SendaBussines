FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=@senda/web --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev"]
