import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
async function boot(page: Page, project: string, extra = "") {
  await page.addInitScript(() => {
    localStorage.setItem(
      "crosstown:settings:v1",
      JSON.stringify({ version: 1, data: { quality: 1, diagnostics: false } }),
    );
  });
  await page.goto(
    `/?test&date=2026-11-20${project === "webgl2-forced" ? "&webgl" : ""}${extra}`,
  );
  await page.waitForFunction(
    () => !!window.__city && !!window.__parkour,
    undefined,
    { timeout: 180000 },
  );
}
async function freeze(page: Page) {
  await page.evaluate(() => {
    window.__parkour!.pause(true);
    document.querySelector<HTMLElement>("#pause-overlay")!.hidden = true;
    document.body.classList.remove("run-paused");
    document.querySelector("#hud")!.classList.remove("is-paused");
  });
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
}

test("opening choices, real keyboard A/D, stable camera yaw and saved run length work", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await boot(page, info.project.name, "&setup");
  await expect(page.locator(".session-setup")).toBeVisible();
  await expect(page.locator('[name="run-length"]')).toHaveCount(3);
  expect((await page.evaluate(() => window.__parkour!.snapshot())).total).toBe(
    8,
  );
  if (info.project.name === "webgl2-forced" || process.env.CAPTURE_CITY === "1")
    await shot(page, "03-run-choices");
  await page.locator('.length-choice:has([value="standard"])').click();
  await page.locator("#setup-sensitivity").evaluate((el) => {
    (el as HTMLInputElement).value = "0.65";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#session-start").click();
  await expect
    .poll(
      async () => page.evaluate(() => window.__parkour!.snapshot().length),
      { timeout: 90000 },
    )
    .toBe("standard");
  await expect(page.locator(".session-setup")).toBeHidden();
  await expect
    .poll(async () => page.evaluate(() => window.__parkour!.snapshot().total))
    .toBe(16);
  await expect
    .poll(
      async () => page.evaluate(() => window.__parkour!.snapshot().choosing),
      { timeout: 120000 },
    )
    .toBe(false);
  await page.evaluate(() => window.__parkour!.reset());
  const before = await page.evaluate(() => window.__parkour!.snapshot());
  await page.keyboard.down("KeyA");
  await expect
    .poll(async () => page.evaluate(() => window.__parkour!.snapshot().moveX))
    .toBe(-1);
  await expect
    .poll(
      async () => page.evaluate(() => window.__parkour!.snapshot().position.x),
      { timeout: 20000 },
    )
    .toBeGreaterThan(before.position.x + 0.4);
  await page.keyboard.up("KeyA");
  const left = await page.evaluate(() => window.__parkour!.snapshot());
  expect(left.cameraYaw).toBeCloseTo(before.cameraYaw, 4);
  await page.keyboard.down("KeyD");
  await expect
    .poll(async () => page.evaluate(() => window.__parkour!.snapshot().moveX))
    .toBe(1);
  await expect
    .poll(async () =>
      page.evaluate(() => window.__parkour!.snapshot().position.x),
    )
    .toBeLessThan(left.position.x - 0.3);
  await page.keyboard.up("KeyD");
  expect(
    (await page.evaluate(() => window.__parkour!.snapshot())).cameraYaw,
  ).toBeCloseTo(before.cameraYaw, 4);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crosstown:preferences:v1")!),
  );
  expect(saved.data.length).toBe("standard");
  expect(saved.data.sensitivity).toBe(0.65);
  await page.reload();
  await page.waitForFunction(() => !!window.__city, undefined, {
    timeout: 180000,
  });
  expect((await page.evaluate(() => window.__parkour!.snapshot())).length).toBe(
    "standard",
  );
  expect(errors).toEqual([]);
});

test("seven districts render, the map covers the full city, dates change weather and dusk switches lights", async ({
  page,
}, info) => {
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await boot(page, info.project.name);
  await freeze(page);
  const layout = await page.evaluate(() => window.__city!.layout());
  expect(layout.districts).toHaveLength(7);
  expect(
    layout.markers.filter((m: { type: string }) => m.type === "parkour"),
  ).toHaveLength(6);
  expect(layout.features.length).toBeGreaterThan(8);
  const states = [];
  for (const [i, d] of layout.districts.entries()) {
    await page.evaluate((d) => {
      window.__city!.hour(16);
      window.__city!.fly(
        {
          x: d.center.x - 100,
          y: d.id === "hills" ? 180 : 100,
          z: d.center.z - 120,
        },
        { x: d.center.x, y: d.id === "hills" ? 40 : 0, z: d.center.z + 70 },
      );
    }, d);
    await expect
      .poll(
        async () =>
          page.evaluate((d) => {
            const s = window.__city!.snapshot().stream;
            return (
              Math.abs(s.anchor.x - (d.center.x - 100)) < 1 &&
              Math.abs(s.anchor.z - (d.center.z - 120)) < 1 &&
              s.nearbyLoaded >= 9
            );
          }, d),
        { timeout: 90000 },
      )
      .toBe(true);
    await page.waitForTimeout(1200);
    const s = await page.evaluate(() => window.__city!.snapshot());
    expect(s.stream.continuousFarCoverage).toBe(true);
    expect(s.stream.farImpostors).toBeGreaterThan(1000);
    states.push({ renderer: info.project.name, district: d.id, ...s });
    if (
      info.project.name === "webgl2-forced" ||
      process.env.CAPTURE_CITY === "1"
    )
      await shot(page, `district-${i + 1}-${d.id}`);
  }
  for (const p of [
    { x: -1900, y: 450, z: -1900 },
    { x: 1900, y: 650, z: -1900 },
    { x: 1900, y: 450, z: 1900 },
    { x: -1900, y: 350, z: 1900 },
  ]) {
    await page.evaluate((p) => window.__city!.fly(p, { x: 0, y: 0, z: 0 }), p);
    await page.waitForTimeout(350);
    expect(
      (await page.evaluate(() => window.__city!.snapshot())).stream
        .continuousFarCoverage,
    ).toBe(true);
  }
  await page.evaluate(() => {
    window.__city!.fly({ x: 560, y: 90, z: -150 }, { x: 650, y: 10, z: 200 });
    window.__city!.date("2026-11-20");
    window.__city!.hour(12);
  });
  await page.waitForTimeout(2500);
  const day = await page.evaluate(() => window.__city!.snapshot().environment);
  expect(day.weather).toBe("clear");
  expect(day.night).toBe(0);
  if (info.project.name === "webgl2-forced" || process.env.CAPTURE_CITY === "1")
    await shot(page, "04-daylight");
  await page.evaluate(() => window.__city!.hour(22));
  await page.waitForTimeout(2500);
  const night = await page.evaluate(
    () => window.__city!.snapshot().environment,
  );
  expect(night.night).toBe(1);
  if (info.project.name === "webgl2-forced" || process.env.CAPTURE_CITY === "1")
    await shot(page, "05-neon-night");
  await page.evaluate(() => {
    window.__city!.date("2026-11-24");
    window.__city!.hour(15);
  });
  await page.waitForTimeout(2500);
  expect(
    (await page.evaluate(() => window.__city!.snapshot().environment)).weather,
  ).toBe("rain");
  if (info.project.name === "webgl2-forced" || process.env.CAPTURE_CITY === "1")
    await shot(page, "10-rain");
  await page.evaluate(() => window.__city!.date("2026-11-22"));
  await page.waitForTimeout(500);
  expect(
    (await page.evaluate(() => window.__city!.snapshot().environment)).weather,
  ).toBe("fog");
  await page.evaluate(() => window.__parkour!.pause(false));
  await page.keyboard.press("KeyM");
  await expect(page.locator(".city-map-panel")).toBeVisible();
  await page.locator('[data-district="beach"]').click();
  expect(
    (await page.evaluate(() => window.__city!.snapshot())).waypoint.x,
  ).toBe(-1500);
  if (info.project.name === "webgl2-forced" || process.env.CAPTURE_CITY === "1")
    await shot(page, "06-city-map");
  await page.keyboard.press("KeyM");
  await expect(page.locator(".city-map-panel")).toBeHidden();
  await info.attach("city-states-not-a-native-hardware-benchmark", {
    body: JSON.stringify(states, null, 2),
    contentType: "application/json",
  });
  if (info.project.name === "webgl2-forced" || process.env.CAPTURE_CITY === "1")
    await fs.writeFile(
      "docs/CITY-BROWSER-STATES.json",
      JSON.stringify(states, null, 2),
    );
  expect(errors).toEqual([]);
});

test("street mode uses the same animated runner, a real bridge and a frozen rooftop timer", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page, info.project.name);
  await freeze(page);
  const before = await page.evaluate(
    () => window.__parkour!.snapshot().elapsed,
  );
  await page.evaluate(async () => {
    await window.__city!.flush({ x: -850, y: 0, z: -256 });
    window.__city!.street({ x: -810, y: 3.8, z: -256 });
    window.__city!.step(480, { x: -1 });
  });
  const s = await page.evaluate(() => window.__city!.snapshot());
  expect(s.mode).toBe("street");
  expect(s.position.x).toBeLessThan(-850);
  expect(s.position.y).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.__parkour!.snapshot().elapsed)).toBe(
    before,
  );
  await freeze(page);
  if (info.project.name === "webgl2-forced" || process.env.CAPTURE_CITY === "1")
    await shot(page, "07-street-bridge");
  await page.evaluate(() => window.__city!.mode("parkour"));
  expect((await page.evaluate(() => window.__city!.snapshot())).mode).toBe(
    "parkour",
  );
  expect(errors).toEqual([]);
});

test("six worker-generated marker starts relocate the course; caches persist/reset and fly-to-walk lands safely", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page, info.project.name, "&length=quick");
  await freeze(page);
  const markers = await page.evaluate(() =>
    window
      .__city!.layout()
      .markers.filter((m: { type: string }) => m.type === "parkour"),
  );
  for (const marker of markers) {
    expect(
      await page.evaluate(
        (id) => window.__city!.startMarker(id, 84173),
        marker.id,
      ),
    ).toBe(true);
    const fixture = await page.evaluate(() => window.__parkour!.fixture());
    const state = await page.evaluate(() => window.__parkour!.snapshot());
    expect(state.marker).toBe(marker.id);
    expect(fixture.spawn).toEqual(marker.position);
    expect(state.position).toEqual(marker.position);
    expect(state.valid.possible).toBe(true);
    expect(state.total).toBe(8);
  }
  const spot = await page.evaluate(() =>
    window
      .__city!.layout()
      .features.find((f: { type: string }) => f.type === "collectible"),
  );
  expect(
    await page.evaluate((p) => window.__city!.collect(p), {
      ...spot.position,
      y: spot.position.y - 0.8,
    }),
  ).toEqual([spot.id]);
  expect(
    await page.evaluate((p) => window.__city!.collect(p), {
      ...spot.position,
      y: spot.position.y - 0.8,
    }),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("crosstown:city:v1")!).data,
    ),
  ).toContain(spot.id);
  await page.evaluate(() => window.__city!.clearCitySave());
  expect(
    await page.evaluate(() => localStorage.getItem("crosstown:city:v1")),
  ).toBeNull();
  expect(
    (await page.evaluate(() => window.__city!.snapshot())).stream
      .hiddenCachesFound,
  ).toBe(0);
  await page.evaluate(async () => {
    await window.__city!.flush({ x: 1094, y: 90, z: 828 });
    window.__city!.fly({ x: 1094, y: 90, z: 828 }, { x: 1094, y: 18, z: 850 });
    window.__city!.mode("street");
    window.__city!.step(120);
  });
  const landed = await page.evaluate(() => window.__city!.snapshot());
  expect(landed.mode).toBe("street");
  expect(landed.position.y).toBeGreaterThan(17);
  expect(landed.position.y).toBeLessThan(100);
  expect(errors).toEqual([]);
});
