/**
 * Website Analyzer - TRUE Final Version (Shop + Real Summary)
 */

import * as readline from "readline";
import puppeteer, { Page } from "puppeteer";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const SHOP_KEYWORDS = [
  "add to cart",
  "buy now",
  "checkout",
  "cart",
  "korpa",
  "kupi",
  "poruči",
  "rsd",
  "din",
  "€",
  "$",
];

interface Product {
  name: string;
  price: number;
  priceText: string;
}

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

// 🔥 agresivno hvatanje cena (Gigatron killer)
async function extractProducts(page: Page): Promise<Product[]> {
  return await page.evaluate(() => {
    const results: Product[] = [];
    const seen = new Set<string>();

    const parsePrice = (text: string): number | null => {
      if (!text) return null;

      const match = text.match(/(\d[\d\.\, ]{1,12})\s*(rsd|din|€|\$)/i);
      if (!match) return null;

      let cleaned = match[1].replace(/[^\d.,]/g, "");
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");

      const value = parseFloat(cleaned);
      if (isNaN(value)) return null;
      if (value < 100 || value > 10000000) return null;

      return value;
    };

    const elements = Array.from(
      document.querySelectorAll("body *")
    ).slice(0, 5000);

    for (const el of elements) {
      const text = el.textContent?.trim();
      if (!text) continue;

      const price = parsePrice(text);
      if (!price) continue;

      const key = text + price;
      if (seen.has(key)) continue;
      seen.add(key);

      let name = "";

      const container =
        el.closest(
          "[class*='product'], [class*='card'], [class*='item'], article, li"
        ) || el.parentElement;

      if (container) {
        const nameEl =
          container.querySelector(
            ".product-title, .product__title, [class*='product-name'], h2, h3, h4, a"
          );

        name = nameEl?.textContent?.trim() || "";
      }

      if (!name || name.length < 3) {
        name = "Product";
      }

      results.push({
        name: name.slice(0, 120),
        price,
        priceText: text,
      });
    }

    return results;
  });
}

async function analyzeWebsite(url: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    );

    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await sleep(5000);
    await autoScroll(page);
    await sleep(3000);

    const pageText = await page.evaluate(() =>
      document.body.innerText.toLowerCase()
    );

    const hasShopKeyword = SHOP_KEYWORDS.some((word) =>
      pageText.includes(word)
    );

    let products = await extractProducts(page);

    const isShop = hasShopKeyword || products.length > 0;

    // retry za SPA
    if (isShop && products.length === 0) {
      await autoScroll(page);
      await sleep(4000);
      products = await extractProducts(page);
    }

    // ✅ SHOP RESULT
    if (isShop && products.length > 0) {
      const cheapest = products.reduce((min, p) =>
        p.price < min.price ? p : min
      );

      return {
        isShop: true,
        product: cheapest.name,
        price: cheapest.priceText,
      };
    }

    if (isShop) {
      return {
        isShop: true,
        product: null,
        price: null,
      };
    }

    // =========================
    // ✅ REAL SUMMARY FIX
    // =========================
    const summary = await page.evaluate(() => {
      const title = document.title || "";

      const metaDesc =
        document.querySelector('meta[name="description"]')
          ?.getAttribute("content") || "";

      const h1 =
        document.querySelector("h1")?.textContent?.trim() || "";

      const paragraphs = Array.from(document.querySelectorAll("p"))
        .map((p) => p.textContent?.trim())
        .filter(
          (t) =>
            t &&
            t.length > 80 &&
            !t.toLowerCase().includes("cookie") &&
            !t.toLowerCase().includes("privacy")
        )
        .slice(0, 3);

      return {
        title,
        metaDesc,
        h1,
        paragraphs,
      };
    });

    const summaryText = [
      summary.title,
      summary.h1,
      summary.metaDesc,
      ...summary.paragraphs,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 800);

    return {
      isShop: false,
      summary: summaryText || "Could not extract summary.",
    };
  } finally {
    await browser.close();
  }
}

// CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

(async () => {
  const input = (await ask("Enter website URL: ")).trim();

  if (!input) {
    console.log("No URL provided.");
    rl.close();
    return;
  }

  let url = input;
  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  try {
    console.log("\nAnalyzing...\n");

    const result = await analyzeWebsite(url);

    if (result.isShop) {
      if (result.product && result.price) {
        console.log(
          `This website is a shop.\n\nCheapest product:\n${result.product}\nPrice: ${result.price}`
        );
      } else {
        console.log(
          "This website appears to be a shop, but no products were detected on this page."
        );
      }
    } else {
      console.log("This website is NOT a shop.\n");
      console.log(result.summary);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    rl.close();
  }
})();