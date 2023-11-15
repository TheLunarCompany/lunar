# Heartbeat

When running in a `prod` or `staging` environment (set by the `ENV` environment variable), Lunar Proxy sends a heartbeat to a centralized [Sentry]("https://sentry.io") every 30 minutes (configurable).
The heartbeat includes:
- Timestamp
- Tenant name (set by the `TENANT_NAME` environment variable, e.g. "acme-corporation")
- Lunar Engine Go version + dependency versions
- OS name + version
- Pod/Container name
- CPU Architecture + number of cores
