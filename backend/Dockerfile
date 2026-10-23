# syntax=docker/dockerfile:1.7
# Builder runs natively and cross-compiles for the target platform.
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server
RUN mkdir -p /out/data/uploads

FROM gcr.io/distroless/static-debian12:nonroot
LABEL org.opencontainers.image.title="i-ship-api"
WORKDIR /app
COPY --from=build /out/server /app/server
COPY --from=build --chown=65532:65532 /out/data /data
ENV APP_PORT=8080 UPLOAD_DIR=/data/uploads
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/app/server", "healthcheck"]
ENTRYPOINT ["/app/server"]
CMD ["serve"]
