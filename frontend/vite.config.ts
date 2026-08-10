import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';

// /summary, /sessions, and /anomalies are now BOTH proxied API path prefixes
// AND client-side (react-router) routes (Phase 5). Without this, a hard
// navigation/fresh-tab load of e.g. /sessions?user_id=1 gets proxied straight
// to the backend's JSON API instead of serving the SPA shell that would let
// react-router take over. Real page navigations send an Accept header that
// includes text/html; the app's own fetch() calls (api.ts) don't set one and
// default to `*/*`, so this reliably tells the two apart — bypass returning a
// path makes Vite serve that path itself instead of proxying the request.
function bypassNavigation(req: IncomingMessage) {
  if (req.headers.accept?.includes('text/html')) {
    return '/index.html';
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the backend during dev so the frontend can call
      // relative paths like /summary without hardcoding a host/port.
      '/summary': { target: 'http://localhost:4000', bypass: bypassNavigation },
      '/action_trends': 'http://localhost:4000',
      // API-only: the Overview screen lives at `/`, not `/overview`, precisely so this
      // path never doubles as a client route and needs no navigation bypass.
      '/overview': 'http://localhost:4000',
      '/sessions': { target: 'http://localhost:4000', bypass: bypassNavigation },
      '/anomalies': { target: 'http://localhost:4000', bypass: bypassNavigation },
      '/users': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
      '/load': 'http://localhost:4000',
    },
  },
});
