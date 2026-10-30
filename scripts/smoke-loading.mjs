import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:4322").origin;
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const production = process.argv.includes("--production");

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.setCacheEnabled(false);
  await page.setJavaScriptEnabled(false);
  await page.goto(`${origin}/`, { waitUntil: "load" });
  assert.equal(await page.$eval(".profile-avatar", (element) => getComputedStyle(element).opacity), "1");
  assert.equal(await page.$eval(".profile-avatar", (element) =>
    getComputedStyle(element).visibility === "visible" && element.getBoundingClientRect().height > 0), true);
  assert.equal(await page.$eval("main", (element) => element.inert), false);

  await page.setJavaScriptEnabled(true);
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(`${origin}/blog/`, { waitUntil: "load" });
  await page.waitForSelector('[data-slide-index="1"][data-active="true"]');
  assert.equal(await page.$(".profile-avatar"), null);
  assert.equal(await page.$eval("main", (element) => element.inert), false);
  assert.equal(await page.$eval("[data-loading-overlay]", (element) => element.dataset.state), "idle");
  // Cover the previous three-second background-preload timer.
  await new Promise((resolve) => setTimeout(resolve, 3300));
  assert.equal(requests.includes("/api/github-contributions.json"), false);
  for (const path of ["/", "/project/", "/note/", "/links/", "/about/"]) {
    assert.equal(requests.includes(path), false, `${path} should not preload without intent`);
  }

  const aboutLink = '.desktop-nav a[href="/about/"]';
  await page.hover(aboutLink);
  await page.waitForSelector('[data-slide-index="5"][data-load-state="loaded"]');
  await page.click(aboutLink);
  await page.waitForFunction(() => location.pathname === "/about/");
  assert.equal(requests.filter((path) => path === "/about/").length, 1);

  await page.click('a[aria-label="Last4ev3r home"]');
  await page.waitForFunction(() => location.pathname === "/");
  await page.waitForSelector('[data-github-heatmap][data-bound="true"]');
  await page.waitForSelector('[data-wakatime-image][data-bound="true"]');
  assert.equal(await page.$eval(".profile-avatar", (element) => element.getBoundingClientRect().width > 0), true);

  let failNextNote = true;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/note/" && failNextNote) {
      failNextNote = false;
      void request.respond({ status: 503, body: "Temporary failure" });
    } else {
      void request.continue();
    }
  });
  await page.hover('.desktop-nav a[href="/note/"]');
  await page.waitForSelector('[data-slide-index="3"][data-load-state="error"]');
  await page.click('.desktop-nav a[href="/note/"]');
  await page.waitForFunction(() => location.pathname === "/note/");
  await page.waitForSelector('[data-slide-index="3"][data-load-state="loaded"]');
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/");

  if (production) {
    await page.setJavaScriptEnabled(false);
    await page.goto(`${origin}/blog/20261025-01/`, { waitUntil: "load" });
    assert.ok(await page.$('[data-prerendered="true"] img'));
    assert.equal(await page.$eval('.markdown-mermaid__source', (element) => getComputedStyle(element).display), "none");
    await page.setJavaScriptEnabled(true);
  }

  await page.goto(`${origin}/blog/20261025-01/`, { waitUntil: "load" });
  await page.waitForSelector("[data-article-page]");
  assert.equal(await page.$eval(".article-page__content", (element) => getComputedStyle(element).display), "grid");
  assert.equal(await page.$eval(".article-page__main", (element) => getComputedStyle(element).gridColumnStart), "2");
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => entry.name.includes("/fonts/Biotif-"))
    .map((entry) => entry.name));
  assert.ok(fonts.length > 0);
  assert.ok(fonts.every((url) => url.endsWith(".v2.woff2")));
  assert.equal(requests.some((path) => /ContentDetail\..*\.css$/.test(path)), false);
  if (production) {
    const diagram = '[data-prerendered="true"]';
    await page.$eval(diagram, (element) => element.scrollIntoView());
    await page.waitForFunction(() => [...document.querySelectorAll('[data-prerendered] img')]
      .filter((image) => image.getBoundingClientRect().height > 0)
      .every((image) => image.complete && image.naturalWidth > 0));
    assert.equal(await page.$eval(`${diagram} [data-mermaid-theme="dark"]`, (element) => getComputedStyle(element).display), "none");
    await page.click('[data-theme-toggle]');
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    assert.equal(await page.$eval(`${diagram} [data-mermaid-theme="light"]`, (element) => getComputedStyle(element).display), "none");
    assert.equal(await page.$eval(`${diagram} [data-mermaid-theme="dark"]`, (element) => getComputedStyle(element).display), "block");
    const runtimeJs = await page.evaluate(() => performance.getEntriesByType("resource")
      .filter((entry) => /mermaid.*\.js|\/chunk-|\/dagre|\/graphlib/.test(entry.name))
      .map((entry) => entry.name));
    assert.deepEqual(runtimeJs, [], "Static diagrams should not load the Mermaid runtime");
    await page.setViewport({ width: 390, height: 844 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    assert.equal(await page.$eval(".article-page__main", (element) => getComputedStyle(element).gridColumnStart), "1");
    assert.equal(await page.$eval("main", (element) => element.scrollWidth <= window.innerWidth), true);
    await page.goto(`${origin}/blog/`, { waitUntil: "load" });
    const previousAboutRequests = requests.filter((path) => path === "/about/").length;
    await page.tap("[data-mobile-menu-trigger]");
    await page.tap('[data-mobile-menu] a[href="/about/"]');
    await page.waitForFunction(() => location.pathname === "/about/");
    assert.equal(requests.filter((path) => path === "/about/").length, previousAboutRequests + 1);
    assert.equal(await page.$eval("[data-mobile-menu]", (element) => element.hidden), true);
  }

  console.log("Loading smoke check passed: visible first paint, intentional preload, lazy Home widgets, retry, back navigation, shared article styles and versioned fonts.");
} finally {
  await browser.close();
}
