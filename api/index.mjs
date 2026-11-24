let cachedApp = null;

export default async function handler(req, res) {
  try {
    if (!cachedApp) {
      const mod = await import('./_bundle.mjs');
      cachedApp = mod.createApiApp();
    }

    return await new Promise((resolve, reject) => {
      res.once('finish', () => resolve());
      res.once('close', () => resolve());
      try {
        cachedApp(req, res);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.error('Vercel API bootstrap/handler error:', err);
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err ? err.code : null;
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: 'Gagal memuat server API.',
          detail: message,
          code,
        })
      );
    }
  }
}
