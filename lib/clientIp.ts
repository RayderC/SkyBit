import type { NextApiRequest } from 'next';
import net from 'net';

function isPrivate(addr: string): boolean {
  const a = addr.replace(/^::ffff:/i, '');
  if (a === '::1' || /^f[cd]/i.test(a) || /^fe80:/i.test(a)) return true;
  if (!net.isIPv4(a)) return false;
  const [x, y] = a.split('.').map(Number);
  return x === 10 || x === 127 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127);
}

/**
 * The address to rate limit by. Forwarding headers only count when the connection comes from a private
 * address (a tunnel, proxy or Docker's gateway). From the open internet a client could set them to anything.
 */
export function clientIp(req: NextApiRequest): string {
  const socket = req.socket.remoteAddress ?? 'unknown';
  if (!isPrivate(socket)) return socket;
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const xff = req.headers['x-forwarded-for'];
  return (Array.isArray(xff) ? xff[xff.length - 1] : xff)?.split(',').pop()?.trim() || socket;
}
