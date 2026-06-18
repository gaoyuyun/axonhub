FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder

WORKDIR /build
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY ./frontend .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

# Static frontend assets are architecture-independent, so build them once.
FROM --platform=$BUILDPLATFORM alpine AS frontend-dist
COPY --from=frontend-builder /build/dist /dist

FROM --platform=$BUILDPLATFORM golang:alpine AS backend-builder

WORKDIR /build

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
COPY llm/go.mod llm/go.sum llm/
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOTOOLCHAIN=auto go mod download

COPY . .
COPY --from=frontend-dist /dist /build/internal/server/static/dist

ENV GO111MODULE=on \
    CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
ARG VERSION
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    if [ -n "$VERSION" ]; then printf '%s\n' "$VERSION" > internal/build/VERSION; fi && \
    GOOS="$TARGETOS" GOARCH="$TARGETARCH" GOTOOLCHAIN=auto go build \
    -tags=nomsgpack \
    -ldflags "-s -w -X 'github.com/looplj/axonhub/internal/build.Version=$(cat internal/build/VERSION 2>/dev/null || echo dev)' -X 'github.com/looplj/axonhub/internal/build.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)'" \
    -o axonhub \
    ./cmd/axonhub

FROM --platform=$BUILDPLATFORM alpine AS runtime-files

RUN apk add --no-cache ca-certificates tzdata

FROM alpine

COPY --from=runtime-files /etc/ssl /etc/ssl
COPY --from=runtime-files /usr/share/zoneinfo /usr/share/zoneinfo

WORKDIR /app
COPY --from=backend-builder /build/axonhub /app/axonhub

EXPOSE 8090
ENTRYPOINT ["/app/axonhub"]
