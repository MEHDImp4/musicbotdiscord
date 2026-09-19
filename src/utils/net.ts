import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export type HostResolver = (hostname: string) => Promise<readonly { address: string }[]>;

export const lookupHost: HostResolver = (hostname) => dns.lookup(hostname, { all: true });

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan"];

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }

  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

/** True when the literal IP is loopback, private, link-local, CGNAT, multicast or reserved. */
export function isBlockedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Parses an http(s) URL, rejecting credentials and other schemes. */
export function parseHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export interface UrlSafetyOptions {
  /** When non-empty, only these exact hostnames are allowed. */
  allowedHosts?: readonly string[];
  resolveHost?: HostResolver;
}

/**
 * Synchronous URL-shape/hostname gate. Suitable for `supports()` where DNS is
 * not available; `assertSafeRemoteUrl` performs the async address check.
 */
export function isSafeRemoteUrl(url: string, allowedHosts: readonly string[] = []): boolean {
  const parsed = parseHttpUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (isBlockedHostname(host)) return false;
  if (isIP(host) !== 0 && isBlockedIp(host)) return false;
  if (allowedHosts.length > 0 && !allowedHosts.includes(host)) return false;
  return true;
}

/**
 * Resolves the hostname and rejects any target that is not a public address,
 * mitigating SSRF against loopback/link-local/private/metadata endpoints.
 */
export async function assertSafeRemoteUrl(url: string, options: UrlSafetyOptions = {}): Promise<URL> {
  const parsed = parseHttpUrl(url);
  if (!parsed) throw new Error("URL non supportée (http/https attendu).");

  const host = parsed.hostname.toLowerCase();
  if (isBlockedHostname(host)) throw new Error("Hôte réseau interne refusé.");

  const allowedHosts = options.allowedHosts ?? [];
  if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
    throw new Error("Hôte non autorisé pour la lecture de flux.");
  }

  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error("Adresse réseau interne refusée.");
    return parsed;
  }

  const resolve = options.resolveHost ?? lookupHost;
  let records: readonly { address: string }[];
  try {
    records = await resolve(host);
  } catch {
    throw new Error("Hôte introuvable.");
  }

  if (records.length === 0 || records.some((record) => isBlockedIp(record.address))) {
    throw new Error("Adresse réseau interne refusée.");
  }

  return parsed;
}
