# syntax=docker/dockerfile:1.7

ARG ELECTRON_BUILDER_IMAGE=electronuserland/builder:24-05.26
ARG ELECTRON_BUILDER_WINE_IMAGE=electronuserland/builder:24-wine-05.26

FROM ${ELECTRON_BUILDER_IMAGE} AS kiosk-build

WORKDIR /project

# Keep dependency installation cacheable when application sources change.
COPY package.json package-lock.json ./
COPY admin/package.json admin/package.json
COPY frontend/package.json frontend/package.json
COPY kiosk/package.json kiosk/package.json

RUN --mount=type=cache,target=/root/.npm \
  npm ci --workspace=@jit-studyhub/kiosk

COPY kiosk kiosk

RUN npm run build --workspace=@jit-studyhub/kiosk

FROM kiosk-build AS package-linux

RUN --mount=type=secret,id=kiosk_env,target=/project/kiosk/.env.local,required=true \
  --mount=type=cache,target=/root/.cache/electron \
  --mount=type=cache,target=/root/.cache/electron-builder \
  npm run embed-config --workspace=@jit-studyhub/kiosk \
  && npx electron-builder --projectDir kiosk/electron --linux AppImage --x64 \
  && mkdir -p /artifacts/linux \
  && cp kiosk/dist-electron/*.AppImage /artifacts/linux/ \
  && rm -f kiosk/electron/build-config.cjs

FROM ${ELECTRON_BUILDER_WINE_IMAGE} AS package-windows

WORKDIR /project
COPY --from=kiosk-build /project /project

RUN --mount=type=secret,id=kiosk_env,target=/project/kiosk/.env.local,required=true \
  --mount=type=cache,target=/root/.cache/electron \
  --mount=type=cache,target=/root/.cache/electron-builder \
  npm run embed-config --workspace=@jit-studyhub/kiosk \
  && npx electron-builder --projectDir kiosk/electron --win nsis --x64 \
  && mkdir -p /artifacts/windows \
  && cp kiosk/dist-electron/*.exe kiosk/dist-electron/*.exe.blockmap /artifacts/windows/ \
  && rm -f kiosk/electron/build-config.cjs

FROM scratch AS linux-artifacts
COPY --from=package-linux /artifacts/linux/ /linux/

FROM scratch AS windows-artifacts
COPY --from=package-windows /artifacts/windows/ /windows/

FROM scratch AS all-artifacts
COPY --from=package-linux /artifacts/linux/ /linux/
COPY --from=package-windows /artifacts/windows/ /windows/

