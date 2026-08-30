FROM python:3.12-slim

# Non-root runtime user. Customers deploying their own MCP servers should
# follow the same pattern — see README "Running as non-root" section.
RUN groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid appuser --no-create-home --shell /usr/sbin/nologin appuser

WORKDIR /app
COPY --chown=appuser:appuser pyproject.toml server.py ./
RUN pip install --no-cache-dir .

USER appuser

ENTRYPOINT ["id-aware-mcp-server"]
