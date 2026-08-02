FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends blender ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/workers/paper-doll-renderer
COPY workers/paper-doll-renderer/package.json ./package.json
RUN npm install --omit=dev
COPY workers/paper-doll-renderer ./
COPY docs/paper-doll-rig/cyl9-rollon-stone-layout.json /app/docs/paper-doll-rig/cyl9-rollon-stone-layout.json

RUN useradd --create-home --uid 10001 renderer \
  && mkdir -p /work/output \
  && chown -R renderer:renderer /app /work
USER renderer

CMD ["npm", "start", "--", "--render-pack", "--output", "/work/output"]
