import { describe, expect, it } from "vitest";
import { assertSafeRemoteUrl, isBlockedHostname, isBlockedIp, isSafeRemoteUrl } from "../src/utils/net";

describe("isBlockedIp", () => {
  it("blocks loopback, private, link-local, CGNAT and metadata ranges", () => {
    const blocked = [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.4",
      "172.31.255.254",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "not-an-ip",
    ];
    for (const address of blocked) {
      expect(isBlockedIp(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["1.1.1.1", "8.8.8.8", "203.0.114.1", "2606:4700:4700::1111"]) {
      expect(isBlockedIp(address), address).toBe(false);
    }
  });
});

describe("isBlockedHostname", () => {
  it("blocks local-only hostnames", () => {
    for (const host of ["localhost", "localhost.localdomain", "api.internal", "printer.local", "box.home.arpa"]) {
      expect(isBlockedHostname(host), host).toBe(true);
    }
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});

describe("isSafeRemoteUrl", () => {
  it("rejects non-http schemes, credentials and internal hosts", () => {
    expect(isSafeRemoteUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeRemoteUrl("http://localhost/x")).toBe(false);
    expect(isSafeRemoteUrl("http://api.internal/x")).toBe(false);
    expect(isSafeRemoteUrl("http://user:pass@example.com/x")).toBe(false);
  });

  it("accepts public http(s) and enforces the allowlist", () => {
    expect(isSafeRemoteUrl("https://stream.example.com/live")).toBe(true);
    expect(isSafeRemoteUrl("https://stream.example.com/live", ["other.com"])).toBe(false);
    expect(isSafeRemoteUrl("https://other.com/live", ["other.com"])).toBe(true);
  });
});

describe("assertSafeRemoteUrl", () => {
  it("rejects a hostname resolving to a private address", async () => {
    await expect(
      assertSafeRemoteUrl("https://evil.example.com/x", {
        resolveHost: async () => [{ address: "10.0.0.5" }],
      }),
    ).rejects.toThrow();
  });

  it("accepts a hostname resolving to a public address", async () => {
    const url = await assertSafeRemoteUrl("https://ok.example.com/x", {
      resolveHost: async () => [{ address: "1.2.3.4" }],
    });
    expect(url.hostname).toBe("ok.example.com");
  });

  it("rejects a private literal IP without DNS", async () => {
    await expect(assertSafeRemoteUrl("http://169.254.169.254/latest")).rejects.toThrow();
  });
});
