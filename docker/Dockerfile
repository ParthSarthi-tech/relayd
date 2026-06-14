FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/config/package.json packages/config/tsconfig.json packages/config/
COPY packages/db/package.json packages/db/tsconfig.json packages/db/
COPY apps/api/package.json apps/api/tsconfig.json apps/api/
COPY apps/worker/package.json apps/worker/tsconfig.json apps/worker/
COPY apps/dashboard/package.json apps/dashboard/
COPY "Landing page/package.json" "Landing page/"
RUN pnpm install --frozen-lockfile

COPY packages/config/src packages/config/src
COPY packages/db/src packages/db/src
COPY apps/api/src apps/api/src
COPY apps/worker/src apps/worker/src
COPY apps/dashboard/ apps/dashboard/
COPY "Landing page/" "Landing page/"
RUN pnpm build

FROM node:22-alpine
RUN npm install -g tsx
WORKDIR /app
COPY --from=builder /app .
COPY docker/start.sh ./start.sh
RUN chmod +x start.sh
EXPOSE 3000
CMD ["./start.sh"]
