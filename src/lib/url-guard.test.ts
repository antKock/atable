import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookup } from "node:dns/promises";
import { assertPublicUrl, isPrivateIp, BlockedUrlError } from "./url-guard";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

const mockLookup = vi.mocked(lookup);

beforeEach(() => {
  mockLookup.mockReset();
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
});

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "192.0.2.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:10.0.0.1", // IPv4-mapped
  ])("flags %s as private", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::6810:84e5", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );

  it("treats malformed dotted quads as private (octal/hex bypass)", () => {
    expect(isPrivateIp("0177.0.0.1")).toBe(true);
    expect(isPrivateIp("1.2.3")).toBe(true);
    expect(isPrivateIp("1.2.3.999")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  it("accepts a public HTTPS host", async () => {
    await expect(assertPublicUrl(new URL("https://marmiton.org/r/1"))).resolves.toBeUndefined();
    expect(mockLookup).toHaveBeenCalledWith("marmiton.org", { all: true });
  });

  it("rejects non-HTTPS protocols", async () => {
    await expect(assertPublicUrl(new URL("http://marmiton.org/"))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
    await expect(assertPublicUrl(new URL("ftp://marmiton.org/"))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it.each(["https://localhost/x", "https://foo.localhost/x", "https://db.internal/x", "https://printer.local/x"])(
    "rejects reserved hostname %s",
    async (url) => {
      await expect(assertPublicUrl(new URL(url))).rejects.toBeInstanceOf(BlockedUrlError);
    },
  );

  it("rejects private IP literals without a DNS lookup", async () => {
    await expect(assertPublicUrl(new URL("https://169.254.169.254/meta"))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
    await expect(assertPublicUrl(new URL("https://[::1]/x"))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("accepts a public IP literal", async () => {
    await expect(assertPublicUrl(new URL("https://93.184.216.34/x"))).resolves.toBeUndefined();
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects a hostname resolving to a private address", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as never);
    await expect(assertPublicUrl(new URL("https://evil.example/x"))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it("rejects when ANY resolved record is private (mixed A records)", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.10", family: 4 },
    ] as never);
    await expect(assertPublicUrl(new URL("https://evil.example/x"))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it("rejects unresolvable hosts", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicUrl(new URL("https://nope.example/x"))).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });
});
