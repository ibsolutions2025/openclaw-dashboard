// Vercel serverless function — proxies OpenClaw gateway API calls
// Keeps gateway auth server-side (never exposed to browser)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const gatewayUrl = process.env.GATEWAY_URL;
  const gatewayAuth = process.env.GATEWAY_AUTH;
  const dashboardKey = process.env.DASHBOARD_KEY;

  const authHeader = req.headers['x-dashboard-key'];
  if (dashboardKey && authHeader !== dashboardKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!gatewayUrl) {
    return res.status(500).json({ error: 'GATEWAY_URL not configured' });
  }

  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  const allowed = ['health', 'usage', 'crons', 'sessions', 'status', 'agents'];
  if (!allowed.includes(endpoint)) {
    return res.status(403).json({ error: "Endpoint not allowed" });
  }

  const endpointMap = {
    health: '/api/health',
    usage: '/api/usage',
    crons: '/api/crons',
    sessions: '/api/sessions',
    status: '/api/status',
    agents: '/api/agents',
  };

  const targetUrl = gatewayUrl + endpointMap[endpoint];

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (gatewayAuth) {
      headers['Authorization'] = 'Bearer ' + gatewayAuth;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { text: await response.text() };
    }

    return res.status(response.status).json({
      endpoint,
      timestamp: new Date().toISOString(),
      status: response.status,
      data,
    });
  } catch (err) {
    return res.status(502).json({
      endpoint,
      error: err.message || 'Gateway unreachable',
      timestamp: new Date().toISOString(),
    });
  }
    }
