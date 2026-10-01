import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_URL, httpFetcher } from '../../../src/powers/fetcher';

let server: Server | undefined;
afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
  server = createServer(handler);
  return new Promise((resolve) => server!.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}/c.json`)));
}

describe('httpFetcher', () => {
  it('devuelve el texto con 200', async () => {
    const url = await listen((_req, res) => res.end('{"ok":1}'));
    await expect(httpFetcher(url, 2000)).resolves.toBe('{"ok":1}');
  });
  it('falla con el código HTTP', async () => {
    const url = await listen((_req, res) => {
      res.statusCode = 404;
      res.end('no');
    });
    await expect(httpFetcher(url, 2000)).rejects.toThrow('HTTP 404');
  });
  it('tiempo agotado si el servidor no responde', async () => {
    const url = await listen(() => undefined);
    await expect(httpFetcher(url, 200)).rejects.toThrow(/tiempo agotado/);
  });
  it('la URL oficial es la de GitHub Pages', () => {
    expect(CATALOG_URL).toBe('https://enriquecordero.github.io/sdd-studio/powers/catalog.json');
  });
});
