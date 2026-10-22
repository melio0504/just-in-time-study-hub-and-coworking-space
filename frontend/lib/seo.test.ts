import { describe, expect, it } from "vitest";

import { getSiteUrl, siteConfig } from "./seo";

describe("SEO site URL", () => {
  it("uses the production www hostname by default", () => {
    expect(siteConfig.url).toBe("https://www.jit-studyhub.com");
    expect(getSiteUrl(undefined).origin).toBe("https://www.jit-studyhub.com");
  });

  it("normalizes the legacy apex hostname to the production www hostname", () => {
    expect(getSiteUrl("https://jit-studyhub.com").origin).toBe(
      "https://www.jit-studyhub.com",
    );
  });

  it("does not expose a local development URL in SEO metadata", () => {
    expect(getSiteUrl("http://localhost:3000").origin).toBe(
      "https://www.jit-studyhub.com",
    );
  });
});
