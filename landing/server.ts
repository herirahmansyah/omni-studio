import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const PRODUCT_STUDIO_PORT = Number(process.env.PRODUCT_STUDIO_PORT) || 3001;
  const TRANSITION_STUDIO_PORT = Number(process.env.TRANSITION_STUDIO_PORT) || 3002;

  // Each sub-app is its own standalone Express+Vite server (see
  // omni-product-studio/server.ts and omni-transition-studio/server.ts).
  // They're mounted under BASE_PATH there so their own asset/api paths line
  // up with the prefix we proxy here.
  const productStudioProxy = createProxyMiddleware({
    target: `http://localhost:${PRODUCT_STUDIO_PORT}`,
    changeOrigin: true,
    ws: true,
    pathFilter: '/product-studio',
  });
  const transitionStudioProxy = createProxyMiddleware({
    target: `http://localhost:${TRANSITION_STUDIO_PORT}`,
    changeOrigin: true,
    ws: true,
    pathFilter: '/transition-studio',
  });
  app.use(productStudioProxy);
  app.use(transitionStudioProxy);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Landing server running on http://localhost:${PORT}`);
    console.log(`  → /product-studio proxies to http://localhost:${PRODUCT_STUDIO_PORT}`);
    console.log(`  → /transition-studio proxies to http://localhost:${TRANSITION_STUDIO_PORT}`);
  });
}

startServer();
