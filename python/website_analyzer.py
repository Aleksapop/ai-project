"""
Website Analyzer
Enter a URL - detects if it's an online shop and finds cheapest product,
or provides a short summary for non-shop sites.
"""

import sys

# Common CSS selectors for product prices across various e-commerce platforms
PRICE_SELECTORS = [
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
]

# Selectors for product names/titles
PRODUCT_SELECTORS = [
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
]

# Phrases and symbols that suggest e-commerce
SHOP_INDICATORS = [
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
]


def find_products(page):
    """Extract product names and prices from the page using Playwright."""
    price_selector = ", ".join(PRICE_SELECTORS)
    product_selector = ", ".join(PRODUCT_SELECTORS)

    products = page.evaluate(
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


def get_summary(page):
    """Extract title, meta description, and paragraphs for summary."""
    return page.evaluate(
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


async def analyze_website(url: str) -> dict:
    """Analyze a website: detect if shop, find cheapest product, or summarize."""
    from playwright.async_api import async_playwright

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

            page_content = (await page.inner_text("body")).lower()
            html = (await page.content()).lower()

            is_shop = any(ind in page_content for ind in SHOP_INDICATORS) or any(
                ind in html for ind in SHOP_INDICATORS
            )

            products = find_products(page)

            if is_shop and products:
                cheapest = min(products, key=lambda p: p["price"])
                return {
                    "is_shop": True,
                    "product": cheapest["name"],
                    "price": cheapest["priceText"].strip(),
                }

            if is_shop and not products:
                return {
                    "is_shop": True,
                    "product": None,
                    "price": None,
                }

            # Not a shop - create summary
            summary = get_summary(page)
            parts = [
                summary["title"] and f"Title: {summary['title']}",
                summary["h1"]
                and summary["h1"] != summary["title"]
                and f"Heading: {summary['h1']}",
                summary["metaDesc"],
                *summary["paragraphs"],
            ]
            summary_text = "\n\n".join(p for p in parts if p)[:500] or "Could not extract summary."

            return {"is_shop": False, "summary": summary_text}

        finally:
            await browser.close()


def main():
    url_input = input("Enter website URL: ").strip()
    if not url_input:
        print("No URL provided.")
        sys.exit(1)

    url = url_input
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    try:
        import asyncio

        print("\nAnalyzing website...")
        result = asyncio.run(analyze_website(url))

        if result["is_shop"]:
            if result["product"] and result["price"]:
                print(
                    f'\nThis website is a shop and the cheapest product on this site is "{result["product"]}" and its price is {result["price"]}.'
                )
            else:
                print(
                    "\nThis website appears to be a shop, but no products with prices could be detected on this page."
                )
        else:
            print("\nThis website is not a shop. Short summary:\n")
            print(result["summary"])

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
