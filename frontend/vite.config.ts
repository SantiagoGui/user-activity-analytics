import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the backend during dev so the frontend can call
      // relative paths like /summary without hardcoding a host/port.
      '/summary': 'http://localhost:4000',
      '/action_trends': 'http://localhost:4000',
      '/sessions': 'http://localhost:4000',
      '/anomalies': 'http://localhost:4000',
      '/users': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
      '/load': 'http://localhost:4000',
    },
  },
});
