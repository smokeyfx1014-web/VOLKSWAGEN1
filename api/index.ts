import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server.ts';

let cachedHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedHandler) {
    const app = await createApp({ isServerless: true });
    cachedHandler = app as unknown as (req: IncomingMessage, res: ServerResponse) => void;
  }
  return cachedHandler(req, res);
}
