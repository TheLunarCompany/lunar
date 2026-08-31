# Optional TOA verify for MCPX governance

Lunar MCPX aggregates MCP servers with centralized governance and security.
That answers unified access and policy. It does not prove tool delivery from an
outside probe.

[TOA](https://github.com/Carmel-Labs-Inc/toa) (`toa/0.1`) is optional offline
delivery evidence before enabling a new upstream in MCPX.

```yaml
      - name: Verify tool delivery attestation
        if: hashFiles('toa.json') != ''
        run: |
          pip install "git+https://github.com/Carmel-Labs-Inc/toa.git@345f24607919b5bdf143719b9ea062543cdfe88e#subdirectory=python"
          toa-verify toa.json --require-layer functional=pass
```

Example: [`../examples/toa-after-enable.yml`](../examples/toa-after-enable.yml).

Not per-call. No AgentStatus account required to verify.
