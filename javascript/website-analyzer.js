/**
 * Website Analyzer
 * Enter a URL - detects if it's an online shop and finds cheapest product,
 * or provides a short summary for non-shop sites.
 */

const readline = require("readline");
const puppeteer = require("puppeteer");

// Common CSS selectors for product prices across various e-commerce platforms
const PRICE_SELECTORS = [
  ".price",
  "[class*='price']",
  "[data-price]",
  ".product-price",
  ".woocommerce-Price-amount",
  ".amount",
  "[class*='ProductPrice']",
  "[class*='product-price']",
  ".a-price .a-offscreen",
  "[itemprop='price']",
  ".sales",
  ".current-price",
  ".product__price",
  "[class*='Price']",
  ".money",
  ".currency",
  "[class*='cena']",
  "[class*='Cena']",
];

// Selectors for product names/titles
const PRODUCT_SELECTORS = [
  ".product-title",
  ".product__title",
  "[class*='product-name']",
  "[class*='productName']",
  "h2 a",
  "h3 a",
  ".product-title a",
  "[itemprop='name']",
  ".product-name",
  ".title",
  ".name",
  ".product__name",
];

// Strong e-commerce indicators – rarely appear on informational sites
// Avoid generic terms like "buy" alone – they appear in "how to buy", "buy the book", etc.
const STRONG_SHOP_INDICATORS = [
  "add to cart",
  "add to bag",
  "buy now",
  "checkout",
  "dodaj u korpu",
  "kupi sada",
  "add to basket",
  "dodaj u kolica",
  "order now",
  "kupite odmah",
];

// Weak indicators – can appear on Wikipedia, blogs, etc. (only count if combined with products)
const WEAK_SHOP_INDICATORS = ["shop", "cart", "€", "$", "£", "rsd", "din", "korpa", "kolica"];

// Non-shop signals – hard block: if URL or title matches, never classify as shop
const NON_SHOP_URL_PATTERNS = [
  "wikipedia.org",
  "wikimedia.org",
  "wiki.",
  "wikipedia.",
  "en.wikipedia",
  "encyclopedia",
  "docs.",
  "documentation",
];

// Product container selectors – used to wait for and find product cards
const PRODUCT_CONTAINER_SELECTORS = [
  "[class*='product']",
  "[class*='Product']",
  "[class*='card']",
  "[class*='Card']",
  "[data-product]",
  "[class*='item']",
  "[class*='offer']",
  "[class*='Offer']",
  "[class*='tile']",
  "article",
  ".product",
  "[class*='listing']",
  "[class*='catalog']",
];

// Product link patterns – container-first: find these links, then get card + price
const PRODUCT_LINK_SELECTORS = [
  "a[href*='/proizvod/']",
  "a[href*='/artikal/']",
  "a[href*='/product/']",
  "a[href*='/products/']",
  "a[href*='/p/']",
  "a[href*='/item/']",
  "a[href*='-p-']",
  "a[href*='/catalog/']",
  "a[href*='/katalog/']",
  "a[data-product-id]",
  "a[href*='/product-']",
  "a[href*='/commodity/']",
  "a[href*='/goods/']",
];

/** Scroll page to trigger lazy-loaded content, then wait for stabilization */
async function scrollToLoadProducts(page, options = {}) {
  const { scrollStep = 500, scrollDelay = 400, maxScrolls = 40, minScrolls = 10 } = options;
  await page.evaluate(
    async ({ step, delayMs, max, min }) => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      let prevHeight = 0;
      let height = document.body.scrollHeight;
      let scrollCount = 0;
      while (scrollCount < max && (height > prevHeight || scrollCount < min)) {
        prevHeight = height;
        window.scrollBy(0, step);
        await delay(delayMs);
        height = document.body.scrollHeight;
        scrollCount++;
      }
      window.scrollTo(0, 0);
      await delay(700);
    },
    { step: scrollStep, delayMs: scrollDelay, max: maxScrolls, min: minScrolls }
  );
}

/** Wait until at least one product card (container with product link + price) appears in the DOM */
async function waitForProductCards(page, timeoutMs = 25000) {
  return page
    .waitForFunction(
      () => {
        const productLinks = document.querySelectorAll(
          'a[href*="/proizvod/"], a[href*="/product/"], a[href*="/artikal/"], a[href*="/products/"], a[href*="/item/"], a[href*="/p/"], a[data-product-id]'
        );
        const containerSel =
          "[class*='product'], [class*='card'], [class*='item'], [class*='offer'], [class*='tile'], [class*='listing'], [class*='catalog'], article, li";
        for (const link of productLinks) {
          const root =
            link.closest(containerSel) || link.parentElement?.parentElement || link;
          const text = root?.textContent || "";
          const priceRe = /[\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}\s*(?:rsd|din|€|\$|£)|[\d]+[.,]\d{2}\s*(?:rsd|din|€|\$|£)/i;
          if (priceRe.test(text) || /[\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}/.test(text)) return true;
        }
        const priceEls = document.querySelectorAll(
          "[class*='price'], [data-price], [class*='cena'], [class*='Price'], [itemprop='price']"
        );
        for (const el of priceEls) {
          const container =
            el.closest(containerSel) || el.parentElement?.parentElement?.parentElement;
          if (container?.querySelector("a[href*='/proizvod/'], a[href*='/product/'], a[href*='/artikal/'], a[href*='/products/'], a[href*='/item/']")) return true;
        }
        return false;
      },
      { timeout: timeoutMs }
    )
    .catch(() => null);
}

async function analyzeWebsite(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const pageUrlLower = url.toLowerCase();
    const skipProductExtraction = NON_SHOP_URL_PATTERNS.some(
      (p) => pageUrlLower.includes(p)
    );

    if (!skipProductExtraction) {
      // Initial wait for SPA / React hydration and lazy-loaded content
      await new Promise((r) => setTimeout(r, 3500));

      // First scroll pass – trigger lazy loading before waiting for products
      await scrollToLoadProducts(page);

      // Wait for real product cards (link + price in same container) – handles SPAs
      await waitForProductCards(page, 22000);

      // Fallback: wait for generic selectors if waitForProductCards timed out
      const waitSelector =
        PRODUCT_LINK_SELECTORS.slice(0, 6).join(", ") +
        ", " +
        PRICE_SELECTORS.slice(0, 6).join(", ") +
        ", " +
        PRODUCT_CONTAINER_SELECTORS.slice(0, 5).join(", ");
      await page.waitForSelector(waitSelector, { timeout: 6000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2500));

      // Second scroll pass – more products may load on scroll (especially homepage deals)
      await scrollToLoadProducts(page);
      await page.waitForNetworkIdle({ timeout: 6000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Get page content and check for shop indicators
    const pageContent = await page.evaluate(() => document.body.innerText.toLowerCase());
    const html = await page.content();
    const htmlLower = html.toLowerCase();
    const pageTitle = (await page.title()).toLowerCase();
    const pageUrl = url.toLowerCase();

    const hasStrongIndicator =
      STRONG_SHOP_INDICATORS.some((ind) => pageContent.includes(ind)) ||
      STRONG_SHOP_INDICATORS.some((ind) => htmlLower.includes(ind));
    const weakCount = WEAK_SHOP_INDICATORS.filter(
      (ind) => pageContent.includes(ind) || htmlLower.includes(ind)
    ).length;
    const hasWeakIndicator = weakCount >= 1;

    // Hard block: URL/title indicates informational site – never classify as shop
    const isNonShopByUrlOrTitle = NON_SHOP_URL_PATTERNS.some(
      (pattern) => pageUrl.includes(pattern) || pageTitle.includes(pattern)
    );

    // Extract products: container-first, then price-first, then structure scan
    const products = await page.evaluate(
      (productLinkSelectors, priceSelectors, productSelectors, containerSelectors) => {
        const results = [];
        const seen = new Set();
        const containerSel = containerSelectors.join(", ");

        const parsePricesFromText = (text) => {
          const prices = [];
          const m = (text || "").match(/[\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}|[\d]+[.,]\d{2}/g) || (text || "").match(/[\d][\d.,]*/g) || [];
          for (const numStr of m) {
            const lastComma = numStr.lastIndexOf(",");
            const lastDot = numStr.lastIndexOf(".");
            let s = numStr;
            if (lastComma > lastDot) s = numStr.replace(/\./g, "").replace(",", ".");
            else if (lastDot > lastComma) s = numStr.replace(/,/g, "");
            const p = parseFloat(s);
            if (!isNaN(p) && p >= 100 && p < 5000000) prices.push(p);
          }
          return prices;
        };
        const selectSellingPrice = (prices) => {
          if (prices.length === 0) return NaN;
          prices.sort((a, b) => a - b);
          const idx = prices.length <= 2 ? 0 : Math.floor(prices.length / 2);
          return prices[idx];
        };

        const addProduct = (name, price, priceText) => {
          if (isNaN(price) || price <= 0) return;
          const key = `${(name || "").slice(0, 80)}|${price}`;
          if (seen.has(key)) return;
          seen.add(key);
          results.push({ name: (name || "Product").slice(0, 120), price, priceText: (priceText || "").trim() });
        };

        // Prefer matches that look like real prices (avoid product-name numbers like "5080" concatenated with price)
        const pickPriceText = (text, price) => {
          const strictRe = /[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}\s*(?:rsd|din|€|\$|£)/gi;
          const looseRe = /[\d.,]+[\s]*(?:rsd|din|€|\$|£)/gi;
          const matches = text.match(strictRe) || text.match(looseRe) || [];
          for (const m of matches) {
            const parsed = parsePricesFromText(m);
            const p = selectSellingPrice(parsed);
            if (!isNaN(p) && Math.abs(p - price) < 0.01) return m.trim();
          }
          return String(price);
        };

        // 1. Container-first: find product links, then card + price
        const linkSel = productLinkSelectors.join(", ");
        document.querySelectorAll(linkSel).forEach((link) => {
          const card = link.closest(containerSel) || link.closest("article, li") || link.parentElement?.parentElement;
          const root = card || link;
          let name = (link.textContent || link.getAttribute("aria-label") || link.getAttribute("title") || "").trim().slice(0, 120);
          if (!name || name.length < 3) {
            const nameEl = root.querySelector("h2, h3, h4, [class*='title'], [class*='name']") || root.querySelector("a[href]");
            name = (nameEl?.textContent || "").trim().slice(0, 120);
          }
          if (!name || name.length < 3) return;
          const text = root.textContent || "";
          const prices = parsePricesFromText(text);
          const price = selectSellingPrice(prices);
          if (isNaN(price)) return;
          const priceText = pickPriceText(text, price);
          addProduct(name, price, priceText);
        });

        // 2. Price-first: price elements inside product containers
        if (results.length === 0) {
          document.querySelectorAll(priceSelectors.join(", ")).forEach((el) => {
            const priceText = (el.textContent || el.getAttribute("content") || el.getAttribute("data-price") || "").trim();
            const prices = parsePricesFromText(priceText);
            const price = selectSellingPrice(prices);
            if (isNaN(price)) return;
            let name = "";
            let node = el;
            for (let i = 0; i < 10 && node; i++) {
              const container = node.closest(containerSel) || node.closest("article, li");
              if (container) {
                const sel = productSelectors.join(", ");
                const nameEl = container.querySelector(sel) || container.querySelector("a[href]") || container.querySelector("h2, h3, h4");
                name = (nameEl?.textContent?.trim() || nameEl?.getAttribute?.("title") || "").slice(0, 120);
                if (name && name.length >= 3) break;
              }
              node = node.parentElement;
            }
            addProduct(name || "Product", price, priceText);
          });
        }

        // 3. Structure scan: containers with price-like content + link (catches non-standard layouts)
        if (results.length === 0) {
          document.querySelectorAll(containerSel).forEach((container) => {
            const text = container.textContent || "";
            const priceMatch = text.match(/[\d.,]+\s*(?:rsd|din|€|\$|£)/gi);
            if (!priceMatch) return;
            const prices = parsePricesFromText(text);
            const price = selectSellingPrice(prices);
            if (isNaN(price)) return;
            const link = container.querySelector("a[href*='/']");
            const nameEl = container.querySelector("h2, h3, h4, [class*='title'], [class*='name']") || link;
            const name = (nameEl?.textContent?.trim() || nameEl?.getAttribute?.("title") || "").slice(0, 120);
            if (!name || name.length < 3) return;
            addProduct(name, price, priceMatch[0].trim());
          });
        }

        return results;
      },
      PRODUCT_LINK_SELECTORS,
      PRICE_SELECTORS,
      PRODUCT_SELECTORS,
      PRODUCT_CONTAINER_SELECTORS
    );

    // Shop detection: require strong evidence, avoid false positives on informational sites
    // Never classify as shop if URL/title clearly indicate non-shop (Wikipedia, docs, etc.)
    const isShop =
      !isNonShopByUrlOrTitle &&
      (hasStrongIndicator || (hasWeakIndicator && weakCount >= 2 && products.length >= 1));

    if (isShop && products.length > 0) {
      const cheapest = products.reduce((min, p) => (p.price < min.price ? p : min));
      return {
        isShop: true,
        product: cheapest.name,
        price: cheapest.priceText.trim(),
      };
    }

    if (isShop && products.length === 0) {
      return {
        isShop: true,
        product: null,
        price: null,
      };
    }

    // Not a shop - create summary
    const summary = await page.evaluate(() => {
      const title = document.title || "";
      const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      const paragraphs = Array.from(document.querySelectorAll("p"))
        .slice(0, 3)
        .map((p) => p.textContent?.trim())
        .filter(Boolean);

      return {
        title,
        metaDesc,
        h1,
        paragraphs: paragraphs.slice(0, 2),
      };
    });

    const summaryParts = [
      summary.title && `Title: ${summary.title}`,
      summary.h1 && summary.h1 !== summary.title && `Heading: ${summary.h1}`,
      summary.metaDesc && summary.metaDesc,
      ...summary.paragraphs,
    ].filter(Boolean);

    return {
      isShop: false,
      summary: summaryParts.join("\n\n").slice(0, 500) || "Could not extract summary.",
    };
  } finally {
    await browser.close();
  }
}

// Main
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

(async () => {
  const urlInput = await ask("Enter website URL: ").then((s) => s.trim());
  if (!urlInput) {
    console.log("No URL provided.");
    rl.close();
    return;
  }

  let url = urlInput;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    console.log("\nAnalyzing website...");
    const result = await analyzeWebsite(url);

    if (result.isShop) {
      if (result.product && result.price) {
        console.log(
          `\nThis website is a shop and the cheapest product on this site is "${result.product}" and its price is ${result.price}.`
        );
      } else {
        console.log(
          "\nThis website appears to be a shop, but no products with prices could be detected on this page."
        );
      }
    } else {
      console.log("\nThis website is not a shop. Short summary:\n");
      console.log(result.summary);
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    rl.close();
  }
})();
