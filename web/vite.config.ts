import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function devRelayPlugin(): Plugin {
  const rooms = new Map<string, unknown>();
  const docs = new Map<string, unknown>();
  const sseClients = new Set<ServerResponse>();
  function broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(payload);
      } catch {
        sseClients.delete(res);
      }
    }
  }

  return {
    name: 'dev-relay',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/rooms', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(Array.from(rooms.values())));
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => (body += chunk.toString()));
          req.on('end', () => {
            try {
              const room = JSON.parse(body);
              if (room && typeof room === 'object' && 'id' in room && typeof room.id === 'string') {
                rooms.set(room.id, room);
                broadcast('sync_room', room);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, room }));
              } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'invalid room' }));
              }
            } catch (e: unknown) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: (e as Error).message }));
            }
          });
        }
      });

      server.middlewares.use('/api/docs', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => (body += chunk.toString()));
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              if (payload && typeof payload === 'object' && 'roomId' in payload && typeof payload.roomId === 'string') {
                docs.set(payload.roomId, payload.doc);
                broadcast('sync_doc', payload);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
              } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'invalid doc payload' }));
              }
            } catch (e: unknown) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: (e as Error).message }));
            }
          });
        }
      });
      server.middlewares.use('/api/events', (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
      });
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), svelte(), devRelayPlugin()],
  base: process.env.GITHUB_PAGES ? '/cards/' : './',
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib')
    }
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
});
