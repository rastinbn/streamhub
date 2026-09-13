# StreamHub - MediaMTX runtime
#
# The official `bluenviron/mediamtx` image is scratch-based and ships NO
# shell or HTTP client, so the `runOnOnline` / `runOnOffline` webhook
# commands fail with `exec: "curl": not found`.
#
# Following the upstream convention, we graft a minimal Alpine userspace
# (sh + busybox wget) onto the official MediaMTX binary so the hooks work.
# `redis:7-alpine` is used purely as a conveniently pre-cached Alpine base
# (no package installs, so `docker build` never touches a registry); the
# runtime behavior is otherwise identical to `bluenviron/mediamtx:latest`.
FROM redis:7-alpine

# MediaMTX resolves its config from the process working directory (the
# official image runs with WORKDIR "/"); redis:7-alpine defaults to
# /data, which would make the container start with an empty config.
WORKDIR /

COPY --from=bluenviron/mediamtx:latest /mediamtx /mediamtx
COPY --from=bluenviron/mediamtx:latest /mediamtx.yml /mediamtx.yml

RUN chmod +x /mediamtx

EXPOSE 1935 8554 8888 9997 8892 8893

ENTRYPOINT ["/mediamtx"]