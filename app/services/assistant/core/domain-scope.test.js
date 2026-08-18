import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLightingStoreTopic,
  isOffStoreTopic,
  isEnarteProductUrl,
  toEnarteStoreUrl,
  filterEnarteCatalogCards,
} from "./domain-scope.js";

describe("ENARTE domain scope", () => {
  it("keeps lighting / store questions in domain", () => {
    assert.equal(isLightingStoreTopic("بدي ثريا لغرفة النوم"), true);
    assert.equal(isOffStoreTopic("بدي ثريا لغرفة النوم"), false);
    assert.equal(isOffStoreTopic("كم سعر التوصيل داخل عمان"), false);
    assert.equal(isOffStoreTopic("عندكم تركيب؟"), false);
  });

  it("refuses off-store and non-lighting topics", () => {
    assert.equal(isOffStoreTopic("شو نتيجة مباراة برشلونة"), true);
    assert.equal(isOffStoreTopic("جيب لي كنب من ايكيا"), true);
    assert.equal(isOffStoreTopic("اقترح منتج من امازون"), true);
    assert.equal(isOffStoreTopic("اكتب لي كود بايثون"), true);
  });

  it("rewrites product URLs onto enarteshop.com", () => {
    const url = toEnarteStoreUrl(
      "https://jb8xus-wn.myshopify.com/products/crystal-chandelier",
      "crystal-chandelier",
    );
    assert.equal(url, "https://enarteshop.com/products/crystal-chandelier");
    assert.equal(isEnarteProductUrl(url), true);
  });

  it("drops cards that are not ENARTE catalog items", () => {
    const cards = filterEnarteCatalogCards([
      {
        id: "1",
        title: "ثريا كريستال",
        url: "https://amazon.com/foo",
        handle: "crystal-chandelier",
      },
      { id: "2", title: "" },
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].url, "https://enarteshop.com/products/crystal-chandelier");
  });
});
