import * as cheerio from "cheerio";
import type { FetchedPage, ProductResult } from "../types.js";
import { extractJsonLd, isRecord } from "./jsonLd.js";
import { toAbsoluteUrl } from "../utils/http.js";
import { canonicalProductUrl } from "../utils/productIdentity.js";

const MAX_PRODUCTS_PER_PAGE = 12;

export function extractProductList(page: FetchedPage): ProductResult[] {
  const host = safeHost(page.finalUrl);

  if (!host) {
    return [];
  }

  if (host.includes("product-api.rozetka.com.ua")) {
    return extractRozetkaApiProduct(page);
  }

  if (host.includes("olx.ua")) {
    return extractOlxList(page);
  }

  if (host.includes("prom.ua") || host.includes("bigl.ua")) {
    return extractJsonLdProductList(page, host, "json-ld Product list");
  }

  if (host.includes("hotline.ua")) {
    return extractHotlineList(page);
  }

  if (host.includes("rozetka.com.ua")) {
    return extractRozetkaList(page);
  }

  if (host.includes("zabros.com.ua")) {
    return extractZabrosList(page);
  }

  if (host.includes("fish-fish.com.ua")) {
    return extractFishFishList(page);
  }

  if (host.includes("aquatory.com.ua")) {
    return extractAquatoryList(page);
  }

  if (host.includes("fanatik.com.ua")) {
    return extractFanatikList(page);
  }

  if (host.includes("jdm.com.ua")) {
    return extractJdmUkraineList(page);
  }

  if (host.includes("zenmarket.jp")) {
    return extractZenMarketList(page);
  }

  if (host.includes("jdmtackleheaven.com")) {
    return extractShopifyProductGrid(page, "jdmtackleheaven.com");
  }

  if (host.includes("japantackle.com")) {
    return dedupeProducts([
      ...extractJapanTackleGroupedProduct(page),
      ...extractJapanTackleGrid(page)
    ]);
  }

  if (host.includes("daiwa.in.ua")) {
    return extractDaiwaList(page);
  }

  return extractJsonLdProductList(page, host, "generic json-ld Product list");
}

function extractOlxList(page: FetchedPage): ProductResult[] {
  const html = page.html ?? "";
  const match = html.match(/window\.__PRERENDERED_STATE__=\s*("(?:\\.|[^"\\])*")/);

  if (!match) {
    return extractOlxRenderedList(page);
  }

  try {
    const state = JSON.parse(JSON.parse(match[1])) as unknown;
    const ads = getPath(state, ["listing", "listing", "ads"]);

    if (!Array.isArray(ads)) {
      return [];
    }

    return ads
      .filter(isRecord)
      .map((ad): ProductResult | undefined => {
        const title = stringValue(ad.title);
        const url = stringValue(ad.url);

        if (!title || !url) {
          return undefined;
        }

        const price = getPath(ad, ["price", "regularPrice", "value"]);
        const currency = getPath(ad, ["price", "regularPrice", "currencyCode"]);
        const condition = extractOlxCondition(ad);
        const location = stringValue(getPath(ad, ["location", "pathName"]));
        const image = Array.isArray(ad.photos) ? stringValue(ad.photos[0]) : undefined;

        return {
          title,
          url,
          price: numberValue(price),
          currency: stringValue(currency) ?? "UAH",
          availability: "listed",
          condition,
          seller: location,
          imageUrl: image,
          sourceSite: "olx.ua",
          evidence: ["olx prerendered listing state"],
          confidence: 0.9
        };
      })
      .filter(Boolean)
      .slice(0, MAX_PRODUCTS_PER_PAGE) as ProductResult[];
  } catch {
    return extractOlxRenderedList(page);
  }
}

function extractOlxRenderedList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $('[data-cy="l-card"], [data-testid="l-card"]').each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card
      .find('a[href*="/d/"][href]')
      .filter((__, link) => cleanText($(link).text()).length > 8)
      .first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const priceText = cleanText(card.find('[data-testid="ad-price"]').first().text());
    const price = extractPrice(priceText || cardText);
    const priceAmount = positiveNumber(price.amount);
    const image = card.find("img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");
    const seller = extractOlxRenderedLocation(cardText);

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: priceAmount,
      currency: priceAmount ? price.currency ?? "UAH" : undefined,
      availability: "listed",
      condition: /(^|\s)б\/в(?=\s|$)|вживан/i.test(cardText) ? "used" : /(^|\s)нове(?=\s|$)/i.test(cardText) ? "new" : undefined,
      seller,
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "olx.ua",
      evidence: [price.raw ? `olx rendered card; price pattern: ${price.raw}` : "olx rendered card"],
      confidence: priceAmount ? 0.78 : 0.68
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractJsonLdProductList(page: FetchedPage, sourceSite: string, evidence: string): ProductResult[] {
  return extractJsonLd(page.html)
    .filter(isRecord)
    .filter((node) => jsonLdTypeIncludes(node, "Product"))
    .map((node): ProductResult | undefined => {
      const title = stringValue(node.name);
      const url = stringValue(node.url) ?? stringValue(getPath(node, ["offers", "url"]));

      if (!title || !url) {
        return undefined;
      }

      const offers = firstRecord(node.offers);
      const image = Array.isArray(node.image) ? stringValue(node.image[0]) : stringValue(node.image);
      const seller = stringValue(getPath(offers, ["seller", "name"])) ?? stringValue(getPath(node, ["brand", "name"]));
      const price = positiveNumber(numberValue(offers?.price));

      return {
        title,
        url: toAbsoluteUrl(url, page.finalUrl) ?? url,
        price,
        currency: price ? stringValue(offers?.priceCurrency) : undefined,
        availability: normalizeAvailability(stringValue(offers?.availability)),
        condition: normalizeAvailability(stringValue(offers?.itemCondition)),
        seller,
        imageUrl: image ? toAbsoluteUrl(image, page.finalUrl) ?? image : undefined,
        sourceSite,
        evidence: [evidence],
        confidence: 0.82
      };
    })
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS_PER_PAGE) as ProductResult[];
}

function extractHotlineList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".list-item").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.item-title[href], a[href*='/ua/']").filter((__, link) => {
      const href = $(link).attr("href") ?? "";
      const text = cleanText($(link).text());
      return text.length > 8 && !href.includes("tab=reviews") && !href.includes("/sr/");
    }).first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const price = extractPrice(cardText);
    const image = card.find("img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: positiveNumber(price.amount),
      currency: price.currency,
      availability: "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "hotline.ua",
      evidence: [price.raw ? `hotline list item; price pattern: ${price.raw}` : "hotline list item"],
      confidence: price.amount ? 0.78 : 0.68
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractRozetkaList(page: FetchedPage): ProductResult[] {
  const jsonLdProducts = extractJsonLdProductList(page, "rozetka.com.ua", "rozetka json-ld Product list");

  if (jsonLdProducts.length > 0) {
    return jsonLdProducts;
  }

  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $("rz-catalog-tile, .goods-tile, li.catalog-grid__cell, [data-goods-id]").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card
      .find("a.goods-tile__heading[href], a.tile-title[href], a[href*='/p'][href]")
      .filter((__, link) => cleanText($(link).text()).length > 6)
      .first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const priceText = cleanText(card.find(".goods-tile__price-value, .price_color_red, [class*='price']").first().text());
    const price = extractPrice(priceText || cardText);
    const image = card.find("img[src], img[data-src], img[srcset]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src") ?? firstSrcsetUrl(image.attr("srcset"));

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: price.amount,
      currency: positiveNumber(price.amount) ? price.currency ?? "UAH" : undefined,
      availability: /готовий до відправки|є в наявності|купити|до кошика/i.test(cardText) ? "in_stock" : "listed",
      condition: "new",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "rozetka.com.ua",
      evidence: [price.raw ? `rozetka product card; price pattern: ${price.raw}` : "rozetka product card"],
      confidence: price.amount ? 0.78 : 0.66
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractRozetkaApiProduct(page: FetchedPage): ProductResult[] {
  try {
    const parsed = JSON.parse(page.html ?? "{}") as unknown;
    const data = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : undefined;
    const title = stringValue(data?.title);
    const href = stringValue(data?.href);

    if (!data || !title || !href) {
      return [];
    }

    const image = firstRozetkaImage(data.images);
    const status = stringValue(data.sell_status) ?? stringValue(data.status);
    const seller = stringValue(data.seller_title) ?? stringValue(data.brand) ?? "Rozetka";
    const price = numberValue(data.price);

    return [{
      title,
      url: href,
      price,
      currency: price ? "UAH" : undefined,
      availability: normalizeRozetkaAvailability(status),
      condition: normalizeRozetkaCondition(stringValue(data.state) ?? stringValue(getPath(data, ["product", "state"]))),
      seller,
      imageUrl: image,
      sourceSite: "rozetka.com.ua",
      evidence: [price ? `rozetka product-api get-main; price ${price} UAH` : "rozetka product-api get-main"],
      confidence: price ? 0.88 : 0.74
    }];
  } catch {
    return [];
  }
}

function extractZabrosList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".catalog-item").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.catalog-item-link[href], a[href*='/ua/']").filter((__, link) => {
      const text = cleanText($(link).text());
      const href = $(link).attr("href") ?? "";
      return text.length > 8 && !href.includes("#comments");
    }).first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const price = extractPrice(cardText);
    const image = card.find("img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: price.amount,
      currency: price.currency,
      availability: /є в наявності/i.test(cardText) ? "in_stock" : "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "zabros.com.ua",
      evidence: [price.raw ? `zabros catalog item; price pattern: ${price.raw}` : "zabros catalog item"],
      confidence: price.amount ? 0.76 : 0.66
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractDaiwaList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".product-layout").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a[href]").filter((__, link) => {
      const href = $(link).attr("href") ?? "";
      const text = cleanText($(link).text());
      return text.length > 6 && /^https?:\/\//.test(href);
    }).last();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const price = extractLastPrice(cardText);
    const image = card.find("img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: rawUrl,
      price: price.amount,
      currency: price.currency,
      availability: /в корзину|купити/i.test(cardText) ? "in_stock" : "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "daiwa.in.ua",
      evidence: [price.raw ? `daiwa product grid; price pattern: ${price.raw}` : "daiwa product grid"],
      confidence: price.amount ? 0.76 : 0.66
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractFishFishList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".product-brief[data-product-brief]").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.product-brief__name[href]").first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const priceText = cleanText(card.find("[data-product-brief-price], .product-brief__price").first().text());
    const price = extractPrice(priceText || cardText);
    const image = card.find("a[data-product-brief-picture] img[src], img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: price.amount,
      currency: price.currency,
      availability: /купити|в кошик|вибрати/i.test(cardText) ? "in_stock" : "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "fish-fish.com.ua",
      evidence: [price.raw ? `fish-fish product brief; price pattern: ${price.raw}` : "fish-fish product brief"],
      confidence: price.amount ? 0.77 : 0.67
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractAquatoryList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".preview.fn_product").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.product_name[href]").first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const priceText = cleanText(card.find(".price .fn_price").first().text());
    const currency = cleanText(card.find(".price_currency").first().text());
    const cardText = cleanText(card.text());
    const image = card.find("img.preview_img[src], img.fn_img[src]").first();
    const rawImage = image.attr("src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, "https://aquatory.com.ua/") ?? rawUrl,
      price: numberValue(priceText),
      currency: normalizeCurrency(currency) ?? "UAH",
      availability: /купити|в наявності/i.test(cardText) ? "in_stock" : "listed",
      condition: "new",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "aquatory.com.ua",
      evidence: [priceText ? `aquatory product card; price ${priceText} ${currency}` : "aquatory product card"],
      confidence: priceText ? 0.79 : 0.68
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractFanatikList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".product-thumb.uni-item").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.product-thumb__name[href]").first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const priceNode = card.find(".product-thumb__price").first();
    const dataSpecial = priceNode.attr("data-special");
    const dataPrice = priceNode.attr("data-price");
    const priceText = cleanText(priceNode.text());
    const price = numberValue(dataSpecial && dataSpecial !== "0" ? dataSpecial : dataPrice) ?? extractPrice(priceText).amount;
    const image = card.find(".product-thumb__image img[src], img.img-responsive[src]").first();
    const rawImage = image.attr("src");
    const cardText = cleanText(card.text());

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price,
      currency: "UAH",
      availability: /у кошик|в корзину|купити/i.test(cardText) ? "in_stock" : "listed",
      condition: "new",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "fanatik.com.ua",
      evidence: [priceText ? `fanatik product card; price ${priceText}` : "fanatik product card"],
      confidence: price ? 0.78 : 0.67
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractJdmUkraineList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".product-layout .product-thumb").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find(".caption h4 a[href], a[href] [itemprop=name]").closest("a").first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const priceText = cleanText(card.find(".price .price_no_format, .price-new .price_no_format, .price").first().text());
    const price = extractPrice(priceText);
    const image = card.find("img[itemprop=image][src], img.img-responsive[src]").first();
    const rawImage = image.attr("src")?.trim();
    const cardText = cleanText(card.text());

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: positiveNumber(price.amount),
      currency: positiveNumber(price.amount) ? price.currency ?? "UAH" : undefined,
      availability: /купить|в корзину|до кошика/i.test(cardText) ? "in_stock" : "listed",
      condition: "new",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "jdm.com.ua",
      evidence: [price.raw ? `jdm.com.ua product card; price ${price.raw}` : "jdm.com.ua product card"],
      confidence: price.amount ? 0.78 : 0.67
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractShopifyProductGrid(page: FetchedPage, sourceSite: string): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];
  const seenUrls = new Set<string>();

  $("a.card-link[href*='/products/'], a.full-unstyled-link[href*='/products/'], a[href*='/products/']").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const link = $(element);
    const title = normalizeJdmReelTitle(cleanText(link.text()));
    const rawUrl = link.attr("href");

    if (!title || title.length < 8 || !rawUrl) {
      return undefined;
    }

    const absoluteUrl = toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl;
    const url = canonicalProductUrl(absoluteUrl) ?? absoluteUrl;
    if (seenUrls.has(url)) {
      return undefined;
    }
    seenUrls.add(url);

    const card = link.closest("li, .card-wrapper, .product-card-wrapper, .card, .grid__item");
    const cardText = cleanText((card.length ? card : link.parent()).text());
    const priceText = cleanText(card.find(".price, .money, [class*='price']").first().text());
    const price = extractLastPrice(priceText || cardText);
    const image = card.find("img[src], img[data-src], img[srcset]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src") ?? firstSrcsetUrl(image.attr("srcset"));

    products.push({
      title,
      url,
      price: positiveNumber(price.amount),
      currency: positiveNumber(price.amount) ? price.currency : undefined,
      availability: /sold out|out of stock/i.test(cardText) ? "out_of_stock" : "listed",
      condition: "new",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite,
      evidence: [price.raw ? `shopify product card; price pattern: ${price.raw}` : "shopify product card"],
      confidence: price.amount ? 0.8 : 0.7
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractZenMarketList(page: FetchedPage): ProductResult[] {
  const structuredProducts = extractJsonLdProductList(page, "zenmarket.jp", "zenmarket json-ld Product list");

  if (structuredProducts.length > 0) {
    return structuredProducts;
  }

  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];
  const seenUrls = new Set<string>();
  const linkSelector = [
    "a[href*='auction.aspx']",
    "a[href*='mercari']",
    "a[href*='rakuten']",
    "a[href*='amazon']",
    "a[href*='zenplus']",
    "a[href*='itemCode=']",
    "a[href*='itemId=']",
    "a[href*='itemid=']"
  ].join(",");

  $(linkSelector).each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const link = $(element);
    const rawUrl = link.attr("href");

    if (!rawUrl || /login|signup|help|blog|quickguide|shipping/i.test(rawUrl)) {
      return undefined;
    }

    const absoluteUrl = toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl;
    const url = canonicalProductUrl(absoluteUrl) ?? absoluteUrl;

    if (seenUrls.has(url) || !isZenMarketProductUrl(url)) {
      return undefined;
    }

    const card = link.parent().closest("li, article, tr, [class*='item'], [class*='product'], [class*='card'], [data-testid]");
    const scope = card.length ? card : link.parent();
    const title = zenMarketTitle($, link, scope);

    if (!title || title.length < 6) {
      return undefined;
    }

    seenUrls.add(url);
    const cardText = cleanText(scope.text());
    const priceText = cleanText(scope.find("[class*='price'], [data-testid*='price'], .money").first().text());
    const price = extractLastPrice(priceText || cardText);
    const image = scope.find("img[src], img[data-src], img[srcset]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src") ?? firstSrcsetUrl(image.attr("srcset"));

    products.push({
      title: normalizeJdmReelTitle(title),
      url,
      price: positiveNumber(price.amount),
      currency: positiveNumber(price.amount) ? price.currency : undefined,
      availability: /sold|ended|out of stock|законч|продано/i.test(cardText) ? "out_of_stock" : "listed",
      condition: /中古|used|pre-owned|б\/в/i.test(cardText) ? "used" : undefined,
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "zenmarket.jp",
      evidence: [price.raw ? `zenmarket result card; price pattern: ${price.raw}` : "zenmarket result card"],
      confidence: price.amount ? 0.78 : 0.68
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function zenMarketTitle(
  $: cheerio.CheerioAPI,
  link: cheerio.Cheerio<any>,
  scope: cheerio.Cheerio<any>
): string | undefined {
  const candidates = [
    cleanText(link.attr("title") ?? ""),
    cleanText(link.attr("aria-label") ?? ""),
    cleanText(link.text()),
    cleanText(scope.find("[class*='title'], [class*='name'], [data-testid*='title'], h2, h3").first().text()),
    cleanText(scope.find("img[alt]").first().attr("alt") ?? "")
  ];

  return candidates.find((candidate) => candidate.length >= 6 && !/view|details|watch|add to cart/i.test(candidate));
}

function isZenMarketProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return (
      parsed.hostname.replace(/^www\./, "").endsWith("zenmarket.jp") &&
      (
        path.includes("auction.aspx") ||
        /(?:mercari|rakuten|amazon|zenplus).*product/.test(path) ||
        parsed.searchParams.has("itemCode") ||
        parsed.searchParams.has("itemId") ||
        parsed.searchParams.has("itemid")
      )
    );
  } catch {
    return false;
  }
}

function extractJapanTackleGroupedProduct(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $("#super-product-table tr").slice(1).each((_, row) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const cells = $(row).find("td").map((__, cell) => cleanText($(cell).text())).get();
    const model = cells[0];
    const priceText = cells[8] ?? "";
    const stockText = cells[9] ?? "";

    if (!model) {
      return undefined;
    }

    const price = extractLastPrice(priceText);
    const title = `Shimano 21 ${normalizeJapanTackleModel(model)}`.replace(/\s+/g, " ").trim();
    const variantUrl = addVariantParam(page.finalUrl, model);

    products.push({
      title,
      url: variantUrl,
      price: positiveNumber(price.amount),
      currency: positiveNumber(price.amount) ? price.currency : undefined,
      availability: /out of stock|sold out/i.test(stockText) ? "out_of_stock" : "listed",
      condition: "new",
      sourceSite: "japantackle.com",
      evidence: [
        "japantackle grouped product row",
        price.raw ? `price pattern: ${price.raw}` : undefined,
        stockText || undefined
      ].filter(Boolean) as string[],
      confidence: price.amount ? 0.82 : 0.72
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractJapanTackleGrid(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".category-products .item, .products-grid .item, .products-list .item").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find(".product-name a[href], h2 a[href], a.product-image[href]").filter((__, link) => {
      const text = cleanText($(link).text()) || cleanText($(link).attr("title") ?? "");
      return text.length > 8;
    }).first();
    const title = cleanText(titleLink.text()) || cleanText(titleLink.attr("title") ?? "");
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const priceText = cleanText(card.find(".special-price .price, .regular-price .price, .price-box .price").last().text());
    const price = extractLastPrice(priceText || cardText);
    const image = card.find("img[src]").first();
    const rawImage = image.attr("src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: positiveNumber(price.amount),
      currency: positiveNumber(price.amount) ? price.currency : undefined,
      availability: /out of stock/i.test(cardText) ? "out_of_stock" : "listed",
      condition: "new",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "japantackle.com",
      evidence: [price.raw ? `japantackle product grid; price pattern: ${price.raw}` : "japantackle product grid"],
      confidence: price.amount ? 0.78 : 0.68
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function addVariantParam(url: string, variant: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("variant", variant.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeJapanTackleModel(value: string): string {
  return value
    .replace(/\b(DC|XT|MGL|BFS|K|A)(\d)/gi, "$1 $2")
    .replace(/,\s*/g, " ")
    .replace(/\bleft\b/i, "Left")
    .replace(/\bright\b/i, "Right")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeJdmReelTitle(value: string): string {
  return value
    .replace(/\b(DC|XT|MGL|BFS|K|A)\s*(\d)/gi, "$1 $2")
    .replace(/\b(\d{2,4})(HG|XG|PG|MG|MGL|BFS|DC)\b/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOlxCondition(ad: Record<string, unknown>): string | undefined {
  const params = ad.params;

  if (!Array.isArray(params)) {
    return undefined;
  }

  const state = params.filter(isRecord).find((param) => param.key === "state");
  return stringValue(state?.normalizedValue) ?? stringValue(state?.value);
}

function extractOlxRenderedLocation(text: string): string | undefined {
  const match = text.match(/(?:Нове|Б\/в|Вживане)(?<location>[^-]{2,80})-\s*\d{1,2}\s+[а-яіїєґ]+\s+\d{4}/iu);
  const location = cleanText(match?.groups?.location ?? "");
  return location || undefined;
}

function jsonLdTypeIncludes(node: Record<string, unknown>, typeName: string): boolean {
  const type = node["@type"];
  return Array.isArray(type) ? type.includes(typeName) : type === typeName;
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value) && Array.isArray(value.offers)) {
    return value.offers.find(isRecord) ?? value;
  }

  if (Array.isArray(value)) {
    return value.find(isRecord);
  }

  return isRecord(value) ? value : undefined;
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/[^\d.,\s\u00a0]/g, "").replace(/[\s\u00a0]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveNumber(value?: number): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

function extractPrice(text: string): { amount?: number; currency?: string; raw?: string } {
  const patterns = [
    /(?<amount>\d{1,3}(?:[ \u00a0,]\d{3})+|\d+(?:[.,]\d+)?)\s?(?<currency>грн|₴|UAH|JPY|¥|￥|USD|\$)/i,
    /(?<currency>грн|₴|UAH|JPY|¥|￥|USD|\$)\s?(?<amount>\d{1,3}(?:[ \u00a0,]\d{3})+|\d+(?:[.,]\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const amount = match?.groups?.amount;

    if (amount) {
      return {
        amount: parsePriceAmount(amount),
        currency: normalizeCurrency(match?.groups?.currency),
        raw: match?.[0]
      };
    }
  }

  return {};
}

function extractLastPrice(text: string): { amount?: number; currency?: string; raw?: string } {
  const matches = [
    ...text.matchAll(/(?<amount>\d{1,3}(?:[ \u00a0,]\d{3})+|\d+(?:[.,]\d+)?)\s?(?<currency>грн|₴|UAH|JPY|¥|￥|USD|\$)/gi),
    ...text.matchAll(/(?<currency>грн|₴|UAH|JPY|¥|￥|USD|\$)\s?(?<amount>\d{1,3}(?:[ \u00a0,]\d{3})+|\d+(?:[.,]\d+)?)/gi)
  ];
  const match = matches.at(-1);
  const amount = match?.groups?.amount;

  if (!amount) {
    return {};
  }

  return {
    amount: parsePriceAmount(amount),
    currency: normalizeCurrency(match?.groups?.currency),
    raw: match?.[0]
  };
}

function parsePriceAmount(value: string): number {
  const compact = value.replace(/[ \u00a0]/g, "");
  const normalized = /,\d{3}(?:\D|$)/.test(compact) ? compact.replace(/,/g, "") : compact.replace(",", ".");
  return Number.parseFloat(normalized);
}

function normalizeCurrency(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  const map: Record<string, string> = {
    "₴": "UAH",
    "ГРН": "UAH",
    "¥": "JPY",
    "￥": "JPY",
    "$": "USD"
  };

  return map[upper] ?? upper;
}

function firstSrcsetUrl(value?: string): string | undefined {
  return value?.split(",")[0]?.trim().split(/\s+/)[0];
}

function firstRozetkaImage(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  for (const image of value) {
    if (!isRecord(image)) {
      continue;
    }

    const candidates = [
      getPath(image, ["original", "url"]),
      getPath(image, ["large", "url"]),
      getPath(image, ["medium", "url"]),
      getPath(image, ["preview", "url"])
    ];
    const url = candidates.map(stringValue).find(Boolean);

    if (url) {
      return url;
    }
  }

  return undefined;
}

function normalizeRozetkaAvailability(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/available|active|sell/i.test(value)) {
    return "in_stock";
  }

  if (/out|unavailable|inactive|hidden/i.test(value)) {
    return "out_of_stock";
  }

  return value;
}

function normalizeRozetkaCondition(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/new/i.test(value)) {
    return "new";
  }

  if (/used|second/i.test(value)) {
    return "used";
  }

  return value;
}

function normalizeAvailability(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/OutOfStock|SoldOut/i.test(value)) {
    return "out_of_stock";
  }

  if (/InStock|Available/i.test(value)) {
    return "in_stock";
  }

  if (/UsedCondition/i.test(value)) {
    return "used";
  }

  if (/NewCondition/i.test(value)) {
    return "new";
  }

  return value;
}

function dedupeProducts(products: ProductResult[]): ProductResult[] {
  const byUrl = new Map<string, ProductResult>();

  for (const product of products) {
    if (!byUrl.has(product.url)) {
      byUrl.set(product.url, product);
    }
  }

  return [...byUrl.values()];
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}
