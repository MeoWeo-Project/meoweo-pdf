# Build the static site, then serve it from nginx. Nothing runs server-side at runtime - this image
# exists so the suite can be self-hosted without Cloudflare Pages.
FROM node:22-alpine AS build
WORKDIR /app

# meoweo-shared is a private git dependency, so the build needs git and a credential.
RUN apk add --no-cache git

# Two ways in, because agent forwarding is awkward on Windows and absent in most CI:
#   SSH   : docker build --ssh default .
#   token : docker build --secret id=gh_token,env=GITHUB_TOKEN .
# The token is a mounted secret and the credential is unset in the same layer, so neither the
# token nor the rewritten URL survives into the image.
COPY package.json package-lock.json ./
RUN --mount=type=ssh --mount=type=secret,id=gh_token     sh -eu -c 'if [ -s /run/secrets/gh_token ]; then         TOKEN=$(cat /run/secrets/gh_token);         git config --global url."https://x-access-token:$TOKEN@github.com/".insteadOf "https://github.com/";         npm ci;         git config --global --remove-section url."https://x-access-token:$TOKEN@github.com/";       else         npm ci;       fi'

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
