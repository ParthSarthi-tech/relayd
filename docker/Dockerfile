FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/config/package.json packages/config/tsconfig.json packages/config/
COPY packages/db/package.json packages/db/tsconfig.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

COPY packages/config/src packages/config/src
COPY packages/db/src packages/db/src
COPY apps/api/src apps/api/src
COPY apps/worker/src apps/worker/src

RUN pnpm build --filter @relay/api --filter @relay/worker

# --- API ---
FROM node:22-alpine AS api
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=base /app .
EXPOSE 3000
CMD ["node", "--enable-source-maps", "apps/api/dist/index.js"]

# --- Worker ---
FROM node:22-alpine AS worker
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=base /app .
EXPOSE 3002
CMD ["node", "--enable-source-maps", "apps/worker/dist/index.js"]

# --- Dashboard ---
FROM node:22-alpine AS dashboard-build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/config/package.json packages/config/tsconfig.json packages/config/
COPY packages/db/package.json packages/db/tsconfig.json packages/db/
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile
COPY packages/config/src packages/config/src
COPY packages/db/src packages/db/src
COPY apps/dashboard/ apps/dashboard/
RUN pnpm build --filter @relay/dashboard

# --- Landing page ---
FROM node:22-alpine AS landing-build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY "Landing page/package.json" "Landing page/"
RUN pnpm install --frozen-lockfile --filter @relay/landing
COPY "Landing page/" "Landing page/"
RUN cd "Landing page" && pnpm build

FROM nginx:alpine AS dashboard
COPY --from=dashboard-build /app/apps/dashboard/dist /usr/share/nginx/html
COPY --from=landing-build /app/Landing\ page/out /usr/share/nginx/landing
RUN cat > /etc/nginx/templates/default.conf.template << 'EOF'
server {
    listen 80;
    server_name _;

    # Landing page at root
    root /usr/share/nginx/landing;
    index index.html;

    # Dashboard SPA at /app/
    location /app/ {
        alias /usr/share/nginx/html/;
        try_files $uri $uri/ /app/index.html;
    }

    # API proxy — API_UPSTREAM is substituted at container start
    location /auth/ {
        proxy_pass http://${API_UPSTREAM};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /v1/ {
        proxy_pass http://${API_UPSTREAM};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /healthz {
        proxy_pass http://${API_UPSTREAM};
    }

    location /readyz {
        proxy_pass http://${API_UPSTREAM};
    }

    location /metrics {
        proxy_pass http://${API_UPSTREAM};
    }
}
EOF
EXPOSE 80
