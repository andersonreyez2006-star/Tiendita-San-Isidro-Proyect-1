import app from '../server/app.js';

export default function handler(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const originalPath = requestUrl.searchParams.get('__vercelOriginalApiPath');

  if (originalPath) {
    if (!originalPath.startsWith('/api/')) {
      res.statusCode = 400;
      res.end();
      return;
    }

    requestUrl.searchParams.delete('__vercelOriginalApiPath');
    const query = requestUrl.searchParams.toString();
    req.url = `${originalPath}${query ? `?${query}` : ''}`;
  }

  return app(req, res);
}
