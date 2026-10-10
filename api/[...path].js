export default async function proxyToRailway(req, res) {
  const apiUrl = process.env.RAILWAY_API_URL;
  if (!apiUrl) {
    res.status(503).json({ error: 'Configura RAILWAY_API_URL en las variables de entorno de Vercel.' });
    return;
  }

  let target;
  try {
    target = new URL(req.url, apiUrl);
    const configuredOrigin = new URL(apiUrl);
    if (target.origin !== configuredOrigin.origin || configuredOrigin.protocol !== 'https:') {
      res.status(500).json({ error: 'RAILWAY_API_URL debe ser un origen HTTPS válido.' });
      return;
    }
  } catch {
    res.status(500).json({ error: 'RAILWAY_API_URL no es una URL válida.' });
    return;
  }

  const headers = new Headers();
  for (const name of ['content-type', 'cookie', 'origin', 'x-forwarded-for']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }

  let body;
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    body = Buffer.concat(chunks);
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual'
    });
  } catch {
    res.status(502).json({ error: 'No se pudo conectar con la API alojada en Railway.' });
    return;
  }
  res.status(upstream.status);
  res.setHeader('cache-control', 'no-store');
  for (const name of ['content-type']) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  const cookie = upstream.headers.get('set-cookie');
  if (cookie) res.setHeader('set-cookie', cookie);
  if (req.method === 'HEAD' || upstream.status === 204) {
    res.end();
    return;
  }
  res.send(Buffer.from(await upstream.arrayBuffer()));
}
