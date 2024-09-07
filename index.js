const puppeteer = require('puppeteer');
const fs = require('fs');

class BrowserFactory {
    static async createBrowser() {
        return await puppeteer.launch({ headless: 'shell' });
    }

    static async createPage(browser) {
        const page = await browser.newPage();
        const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
        await page.setUserAgent(ua);
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        return page;
    }
}

class PageInteractor {
    constructor(page, region) {
        this.page = page;
        this.region = region;
    }

    async navigateTo(url) {
        await this.page.goto(url, { waitUntil: 'networkidle0' });
    }

    async selectRegion() {
        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });

        await this.page.waitForSelector('.Region_regionIcon__oZ0Rt');
        await this.page.click('.Region_regionIcon__oZ0Rt');

        await this.page.evaluate((region) => {
            const regionItems = Array.from(document.querySelectorAll('.UiRegionListBase_item___ly_A'));
            const desiredRegion = regionItems.find((item) => item.textContent.includes(region));

            if (desiredRegion) {
                desiredRegion.click();
            }
        }, this.region);
    }

    async makeScreenshot() {
        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        await this.page.screenshot({ path: 'screenshot.jpg' });
    }

    async getProductDto() {
        return this.page.evaluate(() => {
            const getPrice = (selector) => {
                const priceText = document.querySelector(selector)?.textContent.trim() || null;
                return priceText ? priceText.replace(/[^0-9,.-]+/g, '') : null;
            };

            const getReviews = (selector) => {
                return document.querySelector(selector)?.textContent.trim().replace(/\D/g, '') || '0';
            };

            return {
                price: getPrice('.Price_price__QzA8L.Price_size_XL__MHvC1.Price_role_regular__X6X4D') ||
                    getPrice('.Price_price__QzA8L.Price_size_XL__MHvC1.Price_role_discount__l_tpE') ||
                    'null',
                oldPrice: getPrice('.Price_price__QzA8L.Price_size_XS__ESEhJ.Price_role_old__r1uT1') || 'null',
                rating: getPrice('.ActionsRow_stars__EKt42') || '0',
                reviews: getReviews('.ActionsRow_reviews__AfSj_') || '0'
            };
        });
    }

}

class ProductDataSaver {
    static saveToFile(data) {
        const productInfo = `price=${data.price || 'null'}\npriceOld=${data.oldPrice || 'null'}\nrating=${data.rating || '0'}\nreviewCount=${data.reviews || '0'}`;
        fs.writeFileSync('product.txt', productInfo);
    }
}

class ProductScraper {
    constructor(link, region) {
        this.link = link;
        this.region = region;
    }

    async run() {
        try {
            this.browser = await BrowserFactory.createBrowser();
            this.page = await BrowserFactory.createPage(this.browser);

            const interactor = new PageInteractor(this.page, this.region);

            await interactor.navigateTo(this.link);
            await interactor.selectRegion();
            await interactor.makeScreenshot();

            const productData = await interactor.getProductDto();
            ProductDataSaver.saveToFile(productData);
        } catch (error) {
            console.error('Error during scraping process:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

const [link, region] = process.argv.slice(2);

if (!link || !region) {
    console.error('Usage: node index.js <product_link> <region>');
    process.exit(1);
}

(async function main() {
    try {
        const scraper = new ProductScraper(link, region);
        await scraper.run();
    } catch (error) {
        console.error('Failed to scrape product:', error);
    }
})();