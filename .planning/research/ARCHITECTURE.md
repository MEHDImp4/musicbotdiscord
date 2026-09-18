# Architecture Patterns

**Domain:** Containerized Discord bot deployment
**Researched:** 2026-09-18

## Recommended Architecture

Single-container deployment with multi-stage Docker build. The bot runs as a stateless process that maintains a WebSocket connection to Discord's gateway and makes outbound HTTP requests to YouTube for video information.

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │              musicbotdiscord container            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │  │
│  │  │   Node.js   │  │   yt-dlp    │  │  FFmpeg   │ │  │
│  │  │  (PID 1)    │  │  (external) │  │ (external)│ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │  │
│  │         │                │                │       │  │
│  │         └────────────────┼────────────────┘       │  │
│  │                          │                        │  │
│  │                    ┌─────┴─────┐                  │  │
│  │                    │  Process  │                  │  │
│  │                    │  Manager  │                  │  │
│  │                    └─────┬─────┘                  │  │
│  │                          │                        │  │
│  └──────────────────────────┼────────────────────────┘  │
│                             │                           │
└─────────────────────────────┼───────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Discord Gateway  │
                    │   (WebSocket)      │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │   YouTube API      │
                    │   (HTTP)           │
                    └───────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Node.js Process | Main application logic, command handling | Discord Gateway, YouTube API |
| yt-dlp | Video metadata extraction, stream URL resolution | YouTube API |
| FFmpeg | Audio transcoding, stream conversion | yt-dlp (input), @discordjs/voice (output) |
| Docker Container | Isolation, resource management, lifecycle | Docker Host |

### Data Flow

1. **Command Flow**: Discord → Node.js → yt-dlp → FFmpeg → Discord Voice
2. **Health Check**: Docker → Node.js HTTP endpoint → Discord WebSocket status
3. **Shutdown**: Docker SIGTERM → Node.js cleanup → Process exit

## Patterns to Follow

### Pattern 1: Multi-Stage Build
**What:** Separate build and runtime stages to minimize image size
**When:** Always for production Docker images
**Example:**
```dockerfile
# Build stage
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:24-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
USER node
CMD ["node", "dist/index.js"]
```

### Pattern 2: Health Check Endpoint
**What:** HTTP endpoint that verifies bot is responsive
**When:** When using Docker health checks or orchestration
**Example:**
```typescript
import { createServer } from 'http';

const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    const isReady = client.isReady();
    const latency = client.ws.ping;
    res.writeHead(isReady ? 200 : 503);
    res.end(JSON.stringify({ ready: isReady, latency }));
  }
});

healthServer.listen(8080);
```

### Pattern 3: Environment Separation
**What:** Separate .env files for different environments
**When:** When deploying to different platforms (Windows, Docker, Linux)
**Example:**
```yaml
# docker-compose.yml
services:
  musicbot:
    env_file:
      - .env.docker  # Not .env (which has Windows paths)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mounting Host .env File
**What:** Using `env_file: .env` in docker-compose.yml
**Why bad:** Inherits Windows-specific paths that break in Linux containers
**Instead:** Create `.env.docker` with Linux paths, use that in docker-compose.yml

### Anti-Pattern 2: Running as Root
**What:** Running Node.js process as root in container
**Why bad:** Security risk; container breakout could compromise host
**Instead:** Use `USER node` in Dockerfile after build stage

### Anti-Pattern 3: File Logging in Container
**What:** Writing logs to files inside container
**Why bad:** Fills container disk, logs lost on container restart
**Instead:** Output to stdout/stderr, let Docker capture logs

## Scalability Considerations

| Concern | At 1 bot | At 10 bots | At 100 bots |
|---------|----------|------------|-------------|
| Memory | 256MB | 2.5GB | 25GB |
| CPU | 0.5 cores | 5 cores | 50 cores |
| Network | Minimal | Moderate | High |
| Storage | 500MB image | 5GB images | 50GB images |

**Note:** This bot is designed for single-container deployment. Scaling to multiple bots would require orchestration (Docker Swarm, Kubernetes) which is out of scope.

## Sources

- Docker multi-stage builds: https://docs.docker.com/build/building/multi-stage
- Node.js Docker best practices: https://github.com/goldbergyoni/nodebestpractices
- discord.js documentation: https://discord.js.org
- Docker health checks: https://docs.docker.com/engine/reference/builder/#healthcheck
