"""
Website Analyzer
Enter a URL - detects if it's an online shop and finds cheapest product,
or provides a short summary for non-shop sites.
"""

import sys
import asyncio

# ----------------------
# Install and import Playwright if missing
# ----------------------
try:
    from playwright.async_api import async_playwright
except ImportError:
    import subprocess
    import sys

    print("Playwright not found. Installing it now...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.async_api import async_playwright

# ----------------------
# CSS selectors for product prices and names
# ----------------------
PRICE_SELECTORS = [
    ".price", "[class*='price']", "[data-price]", ".product-price",
    ".woocommerce-Price-amount", ".amount", "[class*='ProductPrice']",
    "[class*='product-price']", ".a-price .a-offscreen", "[itemprop='price']",
    ".sales", ".current-price", ".product__price", "[class*='Price']",
    ".money", ".currency",
]

PRODUCT_SELECTORS = [
    ".product-title", ".product__title", "[class*='product-name']", "[class*='productName']",
    "h2 a", "h3 a", ".product-title a", "[itemprop='name']", ".product-name",
    ".title", ".name", ".product__name",
]

# ----------------------
# Helper functions
# ----------------------
async def find_products(page):
    price_selector = ", ".join(PRICE_SELECTORS)
    product_selector = ", ".join(PRODUCT_SELECTORS)

    products = await page.evaluate(
        """
        ([priceSelectors, productSelectors]) => {
            const results = [];
            const seen = new Set();

            document.querySelectorAll(priceSelectors).forEach((el) => {
                const priceText = (el.textContent || el.getAttribute('content') || '').trim();
                const numMatch = priceText.replace(/[^\\d.,]/g, '').match(/[\\d.,]+/);
                if (!numMatch) return;

                let numStr = numMatch[0].replace(',', '.');
                if (numStr.includes(',') && numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
                    numStr = numStr.replace(/\\./g, '').replace(',', '.');
                }
                const price = parseFloat(numStr);
                if (isNaN(price) || price <= 0 || price > 10000000) return;

                const key = priceText + price;
                if (seen.has(key)) return;
                seen.add(key);

                let name = '';
                let node = el;
                for (let i = 0; i < 6 && node; i++) {
                    const container = node.closest(
                        '[class*="product"], [class*="card"], [class*="item"], article, li, .product'
                    );
                    if (container) {
                        const nameEl =
                            container.querySelector(productSelectors) ||
                            container.querySelector('a[href]') ||
                            container.querySelector('h2, h3, h4');
                        name = (nameEl?.textContent?.trim() || '').slice(0, 120);
                        break;
                    }
                    node = node.parentElement;
                }
                if (!name) name = 'Product';

                results.push({ name: name || 'Product', price, priceText });
            });

            return results;
        }
        """,
        [price_selector, product_selector],
    )
    return products

async def get_summary(page):
    return await page.evaluate(
        """
        () => {
            const title = document.title || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            const h1 = document.querySelector('h1')?.textContent?.trim() || '';
            const paragraphs = Array.from(document.querySelectorAll('p'))
                .slice(0, 3)
                .map(p => p.textContent?.trim())
                .filter(Boolean);

            return {
                title,
                metaDesc,
                h1,
                paragraphs: paragraphs.slice(0, 2)
            };
        }
        """
    )

# ----------------------
# Analyze website
# ----------------------
async def analyze_website(url: str) -> dict:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.set_extra_http_headers(
                {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            )
            await page.set_viewport_size({"width": 1280, "height": 800})
            await page.goto(url, wait_until="networkidle", timeout=30000)

            # ----------------------
            # Check for products only
            # ----------------------
            products = await find_products(page)
            is_shop = bool(products)  # only true if at least one product found

            if is_shop:
                cheapest = min(products, key=lambda p: p["price"])
                return {"is_shop": True, "product": cheapest["name"], "price": cheapest["priceText"].strip()}

            # ----------------------
            # Not a shop - summarize
            # ----------------------
            summary = await get_summary(page)
            parts = [
                summary["title"] and f"Title: {summary['title']}",
                summary["h1"] and summary["h1"] != summary["title"] and f"Heading: {summary['h1']}",
                summary["metaDesc"],
                *summary["paragraphs"],
            ]
            summary_text = "\n\n".join(p for p in parts if p)[:500] or "Could not extract summary."

            return {"is_shop": False, "summary": summary_text}
        finally:
            await browser.close()

# ----------------------
# Main program
# ----------------------
def main():
    url_input = input("Enter website URL: ").strip()
    if not url_input:
        print("No URL provided.")
        sys.exit(1)

    url = url_input
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    try:
        print("\nAnalyzing website...")
        result = asyncio.run(analyze_website(url))

        if result["is_shop"]:
            print(f'\nThis website is a shop and the cheapest product on this site is "{result["product"]}" and its price is {result["price"]}.')
        else:
            print("\nThis website is not a shop. Short summary:\n")
            print(result["summary"])

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()