FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm run build

# No se usa `pnpm install --prod` acá: el Prisma Client se genera fuera de node_modules
# (ver "output" en prisma/schema.prisma) y sus dependencias internas quedan hoisteadas en
# la raíz de node_modules vía pnpm-workspace.yaml (publicHoistPattern) — reinstalar en modo
# prod perdería ese hoist. Además el entrypoint necesita el CLI de `prisma` (devDependency)
# para correr `migrate deploy`. Se reusa directo el node_modules ya instalado en "deps".
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY package.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
