# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:24.22.3-bookworm-slim

ARG PNPM_VERSION=12.18.0

FROM ${NODE_IMAGE} AS playwright-version
COPY pnpm-lock.yaml /tmp/pnpm-lock.yaml
RUN grep -m1 -oE '^  playwright@[0-9.]+' /tmp/pnpm-lock.yaml | cut -d@ -f2 > /playwright-version \
    && test -s /playwright-version

FROM ${NODE_IMAGE} AS build
ARG PNPM_VERSION
WORKDIR /repo
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY package.json tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/mcp/package.json packages/mcp/
RUN pnpm install --frozen-lockfile --offline
COPY apps apps
COPY packages packages
RUN pnpm build \
    && pnpm --filter @job-agent/api deploy --prod /out

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    APP_PORT=3000 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=playwright-version /playwright-version /tmp/playwright-version
RUN npx -y "playwright@$(cat /tmp/playwright-version)" install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm
WORKDIR /app
COPY --from=build --chown=node:node /out ./
RUN test "$(./node_modules/.bin/playwright --version)" = "Version $(cat /tmp/playwright-version)" \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
              /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg /tmp/playwright-version
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.APP_PORT + '/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="job-search-agent-api" \
      org.opencontainers.image.source="https://github.com/maxnag/job-search-agent" \
      org.opencontainers.image.version="${APP_VERSION}"
ENV APP_VERSION=${APP_VERSION}
CMD ["node", "--enable-source-maps", "dist/main.js"]
