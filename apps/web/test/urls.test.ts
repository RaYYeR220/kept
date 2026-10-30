import { describe, expect, it } from "vitest";
import { isShopImage } from "../lib/server/urls";

describe("isShopImage", () => {
  it.each([
    ["https://cdn.shopify.com/s/files/1/0250/3698/0323/files/wig.jpg", true],
    ["https://jessies-wig.myshopify.com/cdn/shop/files/a.png", true],
    ["http://cdn.shopify.com/s/files/a.jpg", false],
    ["https://cdn.shopify.com.evil.example/a.jpg", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["https://user:pw@cdn.shopify.com/a.jpg", false],
    ["https://cdn.shopify.com:8443/a.jpg", false],
    ["not a url", false],
  ])("%s → %s", (url, ok) => {
    expect(isShopImage(url)).toBe(ok);
  });
});
