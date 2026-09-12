import { expect, test } from "@playwright/test";

import { closePool, makeUser, resetDatabase, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);
test.afterAll(closePool);

test("the web manifest describes an installable app", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  expect(manifest.name).toBe("Easy Check-In");
  expect(manifest.start_url).toBe("/");
  expect(manifest.display).toBe("standalone");

  // Installability needs a 192 and a 512, and Android needs a maskable one.
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(
    manifest.icons.some(
      (icon: { purpose?: string }) => icon.purpose === "maskable",
    ),
  ).toBe(true);
});

test("every icon the manifest promises is actually served", async ({
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  const sources: string[] = [
    ...manifest.icons.map((icon: { src: string }) => icon.src),
    "/apple-icon.png",
    "/favicon-32.png",
  ];

  for (const src of new Set(sources)) {
    const response = await request.get(src);
    expect(response.status(), `${src} should be served`).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("the service worker is served and registers", async ({ page }) => {
  const worker = await page.request.get("/sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toContain("javascript");

  const user = makeUser("installer");
  await signUp(page, user);

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration =
            await navigator.serviceWorker.getRegistration("/");
          return Boolean(registration);
        }),
      { message: "service worker should register" },
    )
    .toBe(true);
});
