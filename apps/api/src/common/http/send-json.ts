import { promisify } from 'util';
import { gzip } from 'zlib';

const gzipAsync = promisify(gzip);
// Below this, compressing costs more than it saves.
const MIN_GZIP_BYTES = 8 * 1024;

/**
 * Sends `data` as JSON, gzip-compressed when the browser accepts it and the answer is large. Used for the big lists
 * every tab refreshes (all chats, all contacts): their JSON is very repetitive, so it shrinks to a small fraction.
 * Done here rather than with a compression package so deploying needs no new dependency. Compression runs off the
 * main thread (zlib's thread pool), so other requests are not held up.
 */
export async function sendJson(req: any, res: any, data: unknown) {
  const body = Buffer.from(JSON.stringify(data ?? null), 'utf8');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Vary', 'Accept-Encoding');
  const acceptsGzip = /\bgzip\b/.test(String(req?.headers?.['accept-encoding'] || ''));
  if (acceptsGzip && body.length >= MIN_GZIP_BYTES) {
    const zipped = await gzipAsync(body, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(zipped.length));
    res.status(200).end(zipped);
    return;
  }
  res.setHeader('Content-Length', String(body.length));
  res.status(200).end(body);
}
