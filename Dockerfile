FROM node:24.22.2-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY frontend ./frontend
RUN node node_modules/vite/bin/vite.js build --config frontend/vite.config.ts

FROM golang:1.27.3-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -o /server ./cmd/server

FROM scratch
COPY --from=backend /server /server
COPY --from=frontend /app/dist/frontend /frontend
USER 65532:65532
ENV LISTEN_ADDR=0.0.0.0:8080 FRONTEND_DIR=/frontend
EXPOSE 8080
ENTRYPOINT ["/server"]
