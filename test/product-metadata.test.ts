import { describe, expect, it, vi } from 'vitest';

import {
  fetchProductMetadata,
  ProductMetadataError,
  type ProductAiExtractor
} from '../app/lib/product-metadata';

function htmlResponse(html: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(html, { ...init, headers });
}

describe('fetchProductMetadata', () => {
  it('extracts Open Graph product details with bounded, non-forwarding request options', async () => {
    const fetchPage = vi.fn((url: string, init: RequestInit) => {
      void url;
      void init;
      return Promise.resolve(
        htmlResponse(`
        <!doctype html>
        <html>
          <head>
            <meta content="A &amp; B scarf" property="og:title">
            <meta property="product:price:amount" content="£1,299.50">
            <meta property="product:price:currency" content="GBP">
          </head>
        </html>
        `)
      );
    });

    await expect(
      fetchProductMetadata(' https://shop.example/scarf ', 'wishlist.example', { fetchPage })
    ).resolves.toEqual({
      productUrl: 'https://shop.example/scarf',
      title: 'A & B scarf',
      price: '1299.50',
      aiAssisted: false
    });

    expect(fetchPage).toHaveBeenCalledOnce();
    const [requestedUrl, requestInit] = fetchPage.mock.calls[0] ?? [];
    expect(requestedUrl).toBe('https://shop.example/scarf');
    expect(requestInit).toMatchObject({ method: 'GET', redirect: 'manual', cache: 'no-store' });
    const requestHeaders = new Headers(requestInit?.headers);
    expect(requestHeaders.get('User-Agent')).toBe('Family-Wishlist/0.1 product-metadata-fetcher');
    expect(requestHeaders.get('Accept-Language')).toBe('en-GB,en;q=0.8');
    expect(requestHeaders.has('Authorization')).toBe(false);
    expect(requestHeaders.has('Cookie')).toBe(false);
    expect(requestHeaders.has('Referer')).toBe(false);
  });

  it('falls back to JSON-LD and ignores a non-GBP price', async () => {
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [{
              "@type": "Product",
              "name": "Handmade bowl",
              "offers": { "price": "32.00", "priceCurrency": "EUR" }
            }]
          }
        </script>
        `)
      );

    await expect(
      fetchProductMetadata('https://shop.example/bowl', 'wishlist.example', { fetchPage })
    ).resolves.toEqual({
      productUrl: 'https://shop.example/bowl',
      title: 'Handmade bowl',
      price: '',
      aiAssisted: false
    });
  });

  it('reads Product and AggregateOffer variants across JSON-LD graphs and offer arrays', async () => {
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
          <script type="application/ld+json">{ invalid JSON }</script>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [{
                "@type": ["Thing", "Product"],
                "name": "Oak train set",
                "offers": [
                  { "@type": "Offer", "price": "99.00", "priceCurrency": "EUR" },
                  { "@type": "AggregateOffer", "lowPrice": "42.50", "highPrice": "60.00", "priceCurrency": "GBP" }
                ]
              }]
            }
          </script>
        `)
      );

    await expect(
      fetchProductMetadata('https://shop.example/train', 'wishlist.example', { fetchPage })
    ).resolves.toMatchObject({ title: 'Oak train set', price: '42.50', aiAssisted: false });
  });

  it('uses the final JSON-LD breadcrumb as a product-name fallback', async () => {
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    { "@type": "ListItem", "name": "Toys" },
                    { "@type": "ListItem", "item": { "name": "Wooden marble run" } }
                  ]
                },
                { "@type": "Product", "offers": { "price": "28", "priceCurrency": "GBP" } }
              ]
            }
          </script>
        `)
      );

    await expect(
      fetchProductMetadata('https://shop.example/marble-run', 'wishlist.example', { fetchPage })
    ).resolves.toMatchObject({ title: 'Wooden marble run', price: '28.00' });
  });

  it('extracts nested schema.org microdata without relying on regular-expression HTML parsing', async () => {
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
          <div itemprop="name">Example Shop</div>
          <data itemprop="price" content="5.00">Delivery £5.00</data>
          <article itemscope itemtype="https://schema.org/Product">
            <h1 itemprop="name"><span>Hand-painted <strong>jigsaw puzzle</strong></span></h1>
            <data itemprop="price" content="19.95">Now <span>£19.95</span></data>
            <meta itemprop="priceCurrency" content="GBP">
          </article>
        `)
      );

    await expect(
      fetchProductMetadata('https://shop.example/jigsaw', 'wishlist.example', { fetchPage })
    ).resolves.toMatchObject({ title: 'Hand-painted jigsaw puzzle', price: '19.95' });
  });

  it('follows a small number of redirects manually and returns the final product URL', async () => {
    const requestedUrls: string[] = [];
    const fetchPage = (url: string) => {
      requestedUrls.push(url);
      if (requestedUrls.length === 1) {
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { Location: '/products/scarf' }
          })
        );
      }
      return Promise.resolve(htmlResponse('<title>Red scarf</title>'));
    };

    await expect(
      fetchProductMetadata('https://shop.example/go/scarf', 'wishlist.example', { fetchPage })
    ).resolves.toEqual({
      productUrl: 'https://shop.example/products/scarf',
      title: 'Red scarf',
      price: '',
      aiAssisted: false
    });
    expect(requestedUrls).toEqual([
      'https://shop.example/go/scarf',
      'https://shop.example/products/scarf'
    ]);
  });

  it.each([
    'http://localhost:8787/item',
    'http://127.0.0.1/item',
    'http://10.0.0.4/item',
    'http://[::1]/item',
    'http://[0:0:0:0:0:0:0:1]/item',
    'http://[0:0:0:0:0:ffff:7f00:1]/item',
    'https://wishlist.example/item'
  ])('refuses a non-public or same-host target before fetching: %s', async (url) => {
    const fetchPage = vi.fn(() => Promise.resolve(htmlResponse('<title>Should not load</title>')));

    await expect(fetchProductMetadata(url, 'wishlist.example', { fetchPage })).rejects.toThrow(
      'public shop or product page'
    );
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('validates every redirect target before following it', async () => {
    const fetchPage = vi.fn(() =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { Location: 'http://169.254.169.254/latest' }
        })
      )
    );

    await expect(
      fetchProductMetadata('https://shop.example/product', 'wishlist.example', { fetchPage })
    ).rejects.toThrow('public shop or product page');
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it.each([
    'file:///etc/passwd',
    'data:text/html,<title>Not a shop</title>',
    'https://person:secret@shop.example/product'
  ])('refuses an unsafe redirect target: %s', async (location) => {
    const fetchPage = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { Location: location } }))
    );

    await expect(
      fetchProductMetadata('https://shop.example/product', 'wishlist.example', { fetchPage })
    ).rejects.toThrow('public shop or product page');
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('uses Twitter card data only when its matching label identifies a price', async () => {
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
          <meta name="twitter:title" content="Wooden train">
          <meta name="twitter:label1" content="Rating">
          <meta name="twitter:data1" content="4.8">
          <meta name="twitter:label2" content="Price">
          <meta name="twitter:data2" content="£29.50">
        `)
      );

    await expect(
      fetchProductMetadata('https://shop.example/train', 'wishlist.example', { fetchPage })
    ).resolves.toMatchObject({ title: 'Wooden train', price: '29.50' });
  });

  it('uses Amazon product markup for a concise title and the current customer price', async () => {
    const amazonTitle =
      "Montezuma's Black Forest, 70% Cocoa, Dark Chocolate With Cherry, Gluten Free & Naturally Vegan, 90g Bar";
    const amazonTitleHtml =
      'Montezuma&#39;s Black Forest, 70% Cocoa, Dark Chocolate With Cherry, Gluten Free &amp; Naturally Vegan, 90g Bar';
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
          <title>${amazonTitleHtml} : Amazon.co.uk: Grocery</title>
          <script type="application/ld+json">
            { "@type": "Product", "name": "${amazonTitle}", "offers": { "price": "3.49", "priceCurrency": "GBP" } }
          </script>
          <span class="a-price a-text-price"><span class="a-offscreen">£3.49</span></span>
          <input type="hidden" name="items[0.base][customerVisiblePrice][displayString]" value="£3.00">
          <input type="hidden" name="items[0.subscribe][customerVisiblePrice][displayString]" value="£2.55">
          <span id="productTitle">${amazonTitleHtml}</span>
        `)
      );

    await expect(
      fetchProductMetadata(
        'https://www.amazon.co.uk/dp/B085Y25JJ7?ref=example',
        'wishlist.example',
        { fetchPage }
      )
    ).resolves.toEqual({
      productUrl: 'https://www.amazon.co.uk/dp/B085Y25JJ7?ref=example',
      title: "Montezuma's Black Forest",
      price: '3.00',
      aiAssisted: false
    });
  });

  it.each([
    ['<div data-asin-price="16.25" data-asin-currency-code="GBP"></div>', '16.25'],
    ['<input id="attach-base-product-price" value="£18.75">', '18.75'],
    ['<span class="a-price"><span class="a-offscreen">£21.50</span></span>', '21.50'],
    [
      '<span class="priceToPay"><span><span>£</span><span>24</span><span>.99</span></span></span>',
      '24.99'
    ]
  ])('supports an established Amazon price representation: %s', async (priceMarkup, price) => {
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`<span id="productTitle">Family board game</span>${priceMarkup}`)
      );

    await expect(
      fetchProductMetadata('https://www.amazon.co.uk/dp/B012345678', 'wishlist.example', {
        fetchPage
      })
    ).resolves.toMatchObject({ title: 'Family board game', price });
  });

  it.each([
    ['<span id="btAsinTitle">Classic wooden blocks</span>', 'Classic wooden blocks'],
    ['<h1 class="a-size-large">Illustrated story book</h1>', 'Illustrated story book'],
    ['<div id="item_name">Ceramic plant pot</div>', 'Ceramic plant pot']
  ])('supports an established visible product-title representation: %s', async (markup, title) => {
    await expect(
      fetchProductMetadata('https://www.amazon.co.uk/dp/B012345678', 'wishlist.example', {
        fetchPage: () =>
          Promise.resolve(htmlResponse(`${markup}<div data-asin-price="12.00"></div>`))
      })
    ).resolves.toMatchObject({ title, price: '12.00' });
  });

  it('uses visible product fields without shortening non-Amazon titles', async () => {
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
          <title>Example shop</title>
          <h1 id="product-name">Cards Against Humanity, UK Edition</h1>
          <div class="product-price"><span>Now £24.99</span></div>
        `)
      );

    await expect(
      fetchProductMetadata('https://shop.example/cards', 'wishlist.example', { fetchPage })
    ).resolves.toMatchObject({
      title: 'Cards Against Humanity, UK Edition',
      price: '24.99',
      aiAssisted: false
    });
  });

  it('prefers a visibly marked current price over a previous price in the same element', async () => {
    await expect(
      fetchProductMetadata('https://shop.example/cards', 'wishlist.example', {
        fetchPage: () =>
          Promise.resolve(
            htmlResponse(`
              <h1 id="product-name">Family card game</h1>
              <div class="product-price"><span>Was £29.99</span><strong>Now £21.50</strong></div>
            `)
          )
      })
    ).resolves.toMatchObject({ title: 'Family card game', price: '21.50' });
  });

  it('removes a known shop suffix from a document-title fallback', async () => {
    await expect(
      fetchProductMetadata('https://shop.example/cards', 'wishlist.example', {
        fetchPage: () =>
          Promise.resolve(
            htmlResponse(`
              <meta property="og:site_name" content="Example Shop">
              <title>Cards Against Humanity, UK Edition | Example Shop | Games</title>
            `)
          )
      })
    ).resolves.toMatchObject({ title: 'Cards Against Humanity, UK Edition' });
  });

  it('retries an Amazon challenge at its clean product URL and never sends it to AI', async () => {
    const fetchPage = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        htmlResponse(`
          <title>Robot Check</title>
          <form action="/errors/validateCaptcha">
            <input id="captchacharacters">
          </form>
        `)
      )
    );
    const extractWithAi = vi.fn<ProductAiExtractor>();

    await expect(
      fetchProductMetadata(
        'https://www.amazon.co.uk/gp/product/B085Y25JJ7?ref=tracking',
        'wishlist.example',
        { fetchPage, extractWithAi }
      )
    ).rejects.toThrow('verification page');

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage.mock.calls.map(([url]) => url)).toEqual([
      'https://www.amazon.co.uk/gp/product/B085Y25JJ7?ref=tracking',
      'https://www.amazon.co.uk/dp/B085Y25JJ7'
    ]);
    expect(extractWithAi).not.toHaveBeenCalled();
  });

  it('uses product details when a clean-URL retry gets past a shop challenge', async () => {
    const fetchPage = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(htmlResponse('<title>Robot Check</title>'))
      .mockResolvedValueOnce(
        htmlResponse(`
          <span id="productTitle">Montezuma's Black Forest, Dark Chocolate</span>
          <span class="a-price"><span class="a-offscreen">£3.00</span></span>
        `)
      );

    await expect(
      fetchProductMetadata(
        'https://www.amazon.co.uk/dp/B085Y25JJ7?ref=tracking',
        'wishlist.example',
        { fetchPage }
      )
    ).resolves.toEqual({
      productUrl: 'https://www.amazon.co.uk/dp/B085Y25JJ7',
      title: "Montezuma's Black Forest",
      price: '3.00',
      aiAssisted: false
    });
  });

  it('reads only the bounded start of a large page', async () => {
    const page = `<title>Useful title</title>${'x'.repeat(600_000)}`;

    await expect(
      fetchProductMetadata('https://shop.example/large', 'wishlist.example', {
        fetchPage: () => Promise.resolve(htmlResponse(page))
      })
    ).resolves.toMatchObject({ title: 'Useful title' });
  });

  it('cancels a response stream that lands exactly on the byte limit', async () => {
    const cancel = vi.fn();
    const title = '<title>Boundary title</title>';
    const firstChunk = new TextEncoder().encode(`${title}${'x'.repeat(512 * 1024 - title.length)}`);
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(firstChunk);
          controller.enqueue(new TextEncoder().encode('not read'));
        },
        cancel
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

    await expect(
      fetchProductMetadata('https://shop.example/boundary', 'wishlist.example', {
        fetchPage: () => Promise.resolve(response)
      })
    ).resolves.toMatchObject({ title: 'Boundary title' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('sends reduced product evidence to AI and accepts supported GBP details', async () => {
    const extractWithAi = vi.fn<ProductAiExtractor>(() =>
      Promise.resolve({
        title: 'Hand-knitted wool scarf',
        price: '42.50',
        currency: 'GBP'
      })
    );
    const fetchPage = () =>
      Promise.resolve(
        htmlResponse(`
          <html>
            <head><title>Scarves – Example Shop</title></head>
            <body>
              <header><nav>Home Catalogue Sign in Basket</nav></header>
              <div class="cookie-banner">Accept all cookies</div>
              <main>
                <h1>Hand-knitted wool scarf</h1>
                <p>Soft lambswool in moss green.</p>
                <p>Now £42.50</p>
                ${'<p>Long but useful product detail.</p>'.repeat(800)}
                <section class="reviews">Reviews £5.00 delivery Five stars</section>
              </main>
              <footer>Privacy policy Newsletter Instagram</footer>
            </body>
          </html>
        `)
      );

    await expect(
      fetchProductMetadata('https://shop.example/scarf', 'wishlist.example', {
        fetchPage,
        extractWithAi
      })
    ).resolves.toEqual({
      productUrl: 'https://shop.example/scarf',
      title: 'Hand-knitted wool scarf',
      price: '42.50',
      aiAssisted: true
    });

    expect(extractWithAi).toHaveBeenCalledOnce();
    const request = extractWithAi.mock.calls[0]?.[0];
    expect(request).toMatchObject({ needsTitle: true, needsPrice: true });
    expect(request?.pageText).toContain('Hand-knitted wool scarf');
    expect(request?.pageText).toContain('Now £42.50');
    expect(request?.pageText).not.toMatch(/cookie|reviews|newsletter|basket/i);
    expect(request?.pageText.length).toBeLessThanOrEqual(10_000);
  });

  it('keeps deterministic details when AI is unavailable', async () => {
    const extractWithAi = vi.fn(() => Promise.reject(new Error('AI quota exhausted')));

    await expect(
      fetchProductMetadata('https://shop.example/scarf', 'wishlist.example', {
        fetchPage: () =>
          Promise.resolve(
            htmlResponse(
              '<meta property="og:title" content="Reliable scarf"><p>Price on request</p>'
            )
          ),
        extractWithAi
      })
    ).resolves.toEqual({
      productUrl: 'https://shop.example/scarf',
      title: 'Reliable scarf',
      price: '',
      aiAssisted: false
    });
  });

  it('rejects AI values that are not supported by the reduced page text', async () => {
    await expect(
      fetchProductMetadata('https://shop.example/scarf', 'wishlist.example', {
        fetchPage: () =>
          Promise.resolve(
            htmlResponse(
              '<title>Example Shop</title><main><h1>Green scarf</h1><p>£30.00</p></main>'
            )
          ),
        extractWithAi: () =>
          Promise.resolve({ title: 'Invented blue hat', price: '99.99', currency: 'GBP' })
      })
    ).resolves.toEqual({
      productUrl: 'https://shop.example/scarf',
      title: 'Example Shop',
      price: '',
      aiAssisted: false
    });
  });

  it('accepts an AI price with equivalent decimal formatting found in the page', async () => {
    await expect(
      fetchProductMetadata('https://shop.example/scarf', 'wishlist.example', {
        fetchPage: () =>
          Promise.resolve(
            htmlResponse(
              '<title>Example Shop</title><main><h1>Green scarf</h1><p>£42.50</p></main>'
            )
          ),
        extractWithAi: () =>
          Promise.resolve({ title: 'Green scarf', price: '42.5', currency: 'GBP' })
      })
    ).resolves.toMatchObject({ title: 'Green scarf', price: '42.50', aiAssisted: true });
  });

  it.each([
    [
      () =>
        Promise.resolve(new Response('{}', { headers: { 'Content-Type': 'application/json' } })),
      'ordinary product page'
    ],
    [() => Promise.resolve(htmlResponse('<p>No product metadata here</p>')), 'name or price'],
    [() => Promise.resolve(new Response('Forbidden', { status: 403 })), 'wouldn’t share'],
    [() => Promise.resolve(htmlResponse('<title>Access Denied</title>')), 'verification page']
  ])('returns a useful error when the page cannot provide details', async (fetchPage, message) => {
    await expect(
      fetchProductMetadata('https://shop.example/product', 'wishlist.example', { fetchPage })
    ).rejects.toThrow(message);
  });

  it('uses a product-specific error for malformed links', async () => {
    await expect(fetchProductMetadata('not a link', 'wishlist.example')).rejects.toBeInstanceOf(
      ProductMetadataError
    );
  });
});
