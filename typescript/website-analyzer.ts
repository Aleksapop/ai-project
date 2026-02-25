/**
 * Website Analyzer
 * Enter a URL - detects if it's an online shop and finds cheapest product,
 * or provides a short summary for non-shop sites.
 */

import * as readline from "readline";
import puppeteer from "puppeteer";

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

// Selectors that suggest e-commerce
const SHOP_INDICATORS = [
  "add to cart",
  "add to bag",
  "buy now",
  "shop",
  "checkout",
  "cart",
  "€",
  "$",
  "£",
  "rsd",
  "din",
];

interface Product {
  name: string;
  price: number;
  priceText: string;
}

interface ShopResult {
  isShop: true;
  product: string | null;
  price: string | null;
}

interface SummaryResult {
  isShop: false;
  summary: string;
}

type AnalysisResult = ShopResult | SummaryResult;

async function analyzeWebsite(url: string): Promise<AnalysisResult> {
  const browser = await puppeteer.launch({
    headless: true,
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

    // Get page content and check for shop indicators
    const pageContent = await page.evaluate(
      () => document.body.innerText.toLowerCase()
    );
    const html = await page.content();
    const htmlLower = html.toLowerCase();

    const isShop =
      SHOP_INDICATORS.some((ind) => pageContent.includes(ind)) ||
      SHOP_INDICATORS.some((ind) => htmlLower.includes(ind));

    // Find all products with prices (for shop detection)
    const products = await page.evaluate(
      (priceSelectors: string[], productSelectors: string[]): Product[] => {
        const results: Product[] = [];
        const seen = new Set<string>();

        document.querySelectorAll(priceSelectors.join(", ")).forEach((el) => {
          const priceText = (
            el.textContent ||
            el.getAttribute("content") ||
            ""
          ).trim();
          const numMatch = priceText.replace(/[^\d.,]/g, "").match(/[\d.,]+/);
          if (!numMatch) return;

          let numStr = numMatch[0].replace(",", ".");
          if (
            numStr.includes(",") &&
            numStr.lastIndexOf(",") > numStr.lastIndexOf(".")
          ) {
            numStr = numStr.replace(/\./g, "").replace(",", ".");
          }
          const price = parseFloat(numStr);
          if (isNaN(price) || price <= 0 || price > 10000000) return;

          const key = priceText + price;
          if (seen.has(key)) return;
          seen.add(key);

          let name = "";
          let node: Element | null = el;
          for (let i = 0; i < 6 && node; i++) {
            const container = node.closest(
              "[class*='product'], [class*='card'], [class*='item'], article, li, .product"
            );
            if (container) {
              const sel = productSelectors.join(", ");
              const nameEl =
                container.querySelector(sel) ||
                container.querySelector("a[href]") ||
                container.querySelector("h2, h3, h4");
              name = (nameEl?.textContent?.trim() || "").slice(0, 120);
              break;
            }
            node = node.parentElement;
          }
          if (!name) name = "Product";

          results.push({
            name: name || "Product",
            price,
            priceText,
          });
        });

        return results;
      },
      PRICE_SELECTORS,
      PRODUCT_SELECTORS
    );

    if (isShop && products.length > 0) {
      const cheapest = products.reduce((min, p) =>
        p.price < min.price ? p : min
      );
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
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute(
          "content"
        ) || "";
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
      summary:
        summaryParts.join("\n\n").slice(0, 500) || "Could not extract summary.",
    };
  } finally {
    await browser.close();
  }
}

// Main
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

(async () => {
  const urlInput = (await ask("Enter website URL: ")).trim();
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
    console.error("Error:", err instanceof Error ? err.message : String(err));
  } finally {
    rl.close();
  }
})();
