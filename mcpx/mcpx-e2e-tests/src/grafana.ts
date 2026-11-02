import * as http from 'http';

function httpJson(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? Buffer.from(JSON.stringify(body)) : undefined;
    const req = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': String(data.length) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (ok) {
            try {
              resolve(text ? JSON.parse(text) : {});
            } catch {
              resolve(text);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${text}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

export async function waitForGrafanaHealthy(baseUrl: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await httpJson('GET', `${baseUrl}/api/health`);
      if (h && (h.message === 'ok' || h.database === 'ok')) return;
    } catch {
      /* empty */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Grafana did not become healthy at ${baseUrl} within ${timeoutMs}ms`);
}

export async function createGrafanaServiceAccountToken(opts: {
  baseUrl: string;
  adminUser: string;
  adminPass: string;
  saName: string;
  tokenName: string;
  ttlSeconds?: number;
}): Promise<string> {
  const basic = Buffer.from(`${opts.adminUser}:${opts.adminPass}`).toString('base64');
  const authHeader = { Authorization: `Basic ${basic}` };

  const sa = await httpJson(
    'POST',
    `${opts.baseUrl}/api/serviceaccounts`,
    {
      name: opts.saName,
      role: 'Admin',
    },
    authHeader
  );
  if (!sa || !sa.id) throw new Error(`Failed to create service account: ${JSON.stringify(sa)}`);

  const tok = await httpJson(
    'POST',
    `${opts.baseUrl}/api/serviceaccounts/${sa.id}/tokens`,
    {
      name: opts.tokenName,
      secondsToLive: opts.ttlSeconds ?? 3600,
    },
    authHeader
  );
  if (!tok || !tok.key)
    throw new Error(`Failed to create service account token: ${JSON.stringify(tok)}`);
  return tok.key as string;
}

export async function assertGrafanaHealthy(baseUrl: string, adminUser: string, adminPass: string) {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${adminUser}:${adminPass}`).toString('base64'),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Grafana /api/health failed: ${res.status} ${body}`);
  }
}
