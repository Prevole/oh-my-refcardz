import { test } from "@playwright/test";

test("debug auto-scroll", async ({ page }) => {
  await page.goto("/cheatsheets/layout-persistence-fixture");
  await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

  const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  console.log(`docHeight=${docHeight}, viewportHeight=${viewportHeight}`);

  await page.evaluate(() => window.scrollTo(0, 300));
  const scrollY = await page.evaluate(() => window.scrollY);
  console.log(`scrollY after scrollTo(300): ${scrollY}`);

  const firstBlock = page.locator("article[data-layout-card='true']").first();
  const box = await firstBlock.boundingBox();
  console.log("firstBlock box:", JSON.stringify(box));

  const blockId = await firstBlock.getAttribute("data-layout-block-id");
  console.log(`firstBlock id: ${blockId}`);

  const headerBox = await firstBlock.locator("[class*='cardHeader'], [class*='headingBlockHeader']").first().boundingBox();
  console.log("header box:", JSON.stringify(headerBox));
});
