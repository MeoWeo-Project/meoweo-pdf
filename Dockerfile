# Build the static site, then serve it from nginx. Nothing runs server-side at runtime - this image
# exists so the suite can be self-hosted without Cloudflare Pages.
FROM node:22-alpine AS build
WORKDIR /app

# meoweo-shared is a private git dependency, so the build needs git and a credential.
RUN apk add --no-cache git

# A GitHub token is the one credential path that works the same on Linux, macOS, Windows and CI -
# SSH agent forwarding does not (Docker Desktop cannot reach a Git Bash agent, and the Windows
# OpenSSH service is off by default). The token is a mounted secret and the credential is removed
# in the same layer, so neither it nor the rewritten URL survives into the image.
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=gh_token \
    sh -eu -c 'if [ ! -s /run/secrets/gh_token ]; then \
        echo "" >&2; \
        echo "ERROR: GITHUB_TOKEN is empty or unset." >&2; \
        echo "meoweo-shared is a private repo, so the build cannot fetch it without one." >&2; \
        echo "" >&2; \
        echo "  bash / zsh : GITHUB_TOKEN=\$(gh auth token) docker compose build" >&2; \
        echo "  PowerShell : \$env:GITHUB_TOKEN = gh auth token" >&2; \
        echo "               docker compose build" >&2; \
        echo "" >&2; \
        exit 1; \
      fi; \
      TOKEN=$(cat /run/secrets/gh_token); \
      git config --global url."https://x-access-token:$TOKEN@github.com/".insteadOf "https://github.com/"; \
      npm ci; \
      git config --global --remove-section url."https://x-access-token:$TOKEN@github.com/"'

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
