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

const EMBEDDED_IPV4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

function parseHextet(group: string): number {
  return /^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : -1;
}

/**
 * Expands an IPv6 literal into its 16 bytes, supporting `::` compression,
 * embedded dotted IPv4 and zone ids (`%eth0`). Returns undefined when the
 * literal cannot be parsed.
 */
function parseIpv6ToBytes(address: string): number[] | undefined {
  let value = address.toLowerCase().split("%")[0];
  if (!value) return undefined;

  const embedded = value.match(EMBEDDED_IPV4);
  if (embedded) {
    const octets = embedded[1].split(".").map((part) => Number.parseInt(part, 10));
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return undefined;
    }
    const [a, b, c, d] = octets;
    const high = ((a << 8) | b).toString(16);
    const low = ((c << 8) | d).toString(16);
    value = `${value.slice(0, value.length - embedded[1].length)}${high}:${low}`;
  }

  const compression = value.indexOf("::");
  if (compression !== -1 && value.slice(compression + 2).includes("::")) return undefined;

  const headGroups =
    compression === -1
      ? value.split(":").filter(Boolean)
      : value.slice(0, compression).split(":").filter(Boolean);
  const tailGroups =
    compression === -1 ? [] : value.slice(compression + 2).split(":").filter(Boolean);

  let groups: number[];
  if (compression === -1) {
    if (headGroups.length !== 8) return undefined;
    groups = headGroups.map(parseHextet);
  } else {
    if (headGroups.length + tailGroups.length >= 8) return undefined;
    const missing = 8 - headGroups.length - tailGroups.length;
    groups = [
      ...headGroups.map(parseHextet),
      ...new Array<number>(missing).fill(0),
      ...tailGroups.map(parseHextet),
    ];
  }

  if (groups.some((group) => group < 0)) return undefined;

  const bytes: number[] = [];
  for (const group of groups) bytes.push((group >> 8) & 0xff, group & 0xff);
  return bytes;
}

function isPrivateIpv6(address: string): boolean {
  const bytes = parseIpv6ToBytes(address);
  // Unparsable input must fail closed.
  if (!bytes) return true;

  const embeddedIpv4 = (offset: number): boolean =>
    isPrivateIpv4(bytes.slice(offset, offset + 4).join("."));

  // Unspecified (::) and loopback (::1).
  if (bytes.every((byte) => byte === 0)) return true;

  // IPv4-compatible (::x.x.x.x) and IPv4-mapped (::ffff:x.x.x.x), including the
  // hex-encoded forms (::ffff:7f00:1) that a naive dotted-only check misses.
  if (bytes.slice(0, 12).every((byte) => byte === 0)) return embeddedIpv4(12);
  if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return embeddedIpv4(12);
  }

  // NAT64 well-known prefix 64:ff9b::/96 (and local-use 64:ff9b:1::/48).
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) {
    return bytes.slice(4, 12).every((byte) => byte === 0) ? embeddedIpv4(12) : true;
  }

  // 6to4 tunnels embed the IPv4 address in bytes 2..5.
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return embeddedIpv4(2);

  // Unique local fc00::/7.
  if ((bytes[0] & 0xfe) === 0xfc) return true;
  // Link-local fe80::/10.
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
  // Site-local fec0::/10 (deprecated, still internal).
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true;
  // Multicast ff00::/8.
  if (bytes[0] === 0xff) return true;

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
