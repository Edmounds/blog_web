import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test("the custom 404 route is standalone and explicitly returns 404", () => {
  const page = read("src/pages/404.astro");

  assert.match(page, /Astro\.response\.status\s*=\s*404/);
  assert.match(page, /Astro\.response\.statusText\s*=\s*"Not Found"/);
  assert.doesNotMatch(page, /BaseLayout|Header|Footer|RouteBackground|SpaLayout/);
  assert.match(page, /<h1[^>]*>404<\/h1>/);
  assert.match(page, /<p>PAGE NOT FOUND<\/p>/);
});

test("unknown API routes keep a JSON 404 instead of the visual page", () => {
  const api404 = read("src/pages/api/[...path].ts");

  assert.match(api404, /export const ALL/);
  assert.match(api404, /Response\.json/);
  assert.match(api404, /status:\s*404/);
  assert.match(api404, /code:\s*"NOT_FOUND"/);
});

test("the 404 page renders separate responsive visual layers", () => {
  const page = read("src/pages/404.astro");

  for (const asset of [
    "public/images/404-background.png",
    "public/images/404-background-1280.webp",
    "public/images/404-background-1920.webp",
    "public/images/404-background-3840.webp",
    "public/images/404-character.png",
    "public/images/404-character-768.webp",
    "public/images/404-character-1024.webp",
    "public/images/404-character-802.webp",
    "public/images/404-rhine-mark.png",
  ]) {
    assert.equal(exists(asset), true, `${asset} should exist`);
  }

  assert.equal(exists("public/images/404-muelsyse.png"), false);
  assert.match(page, /404-background-1280\.webp 1280w/);
  assert.match(page, /404-character-768\.webp 768w/);
  assert.match(page, /object-fit:\s*cover/);
  assert.match(page, /height:\s*100svh/);
  assert.match(page, /height:\s*100dvh/);
  assert.match(page, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("the 404 message and character form one centered horizontal group", () => {
  const page = read("src/pages/404.astro");

  assert.match(page, /\.not-found__stage\s*\{[^}]*display:\s*flex/s);
  assert.match(page, /\.not-found__stage\s*\{[^}]*flex-direction:\s*row/s);
  assert.match(page, /\.not-found__stage\s*\{[^}]*align-items:\s*center/s);
  assert.match(page, /\.not-found__stage\s*\{[^}]*justify-content:\s*center/s);
  assert.match(page, /\.not-found__stage\s*\{[^}]*gap:\s*0/s);
  assert.doesNotMatch(page, /\.not-found__message\s*\{[^}]*position:\s*absolute/s);
  assert.doesNotMatch(page, /\.not-found__character\s*\{[^}]*position:\s*absolute/s);
});

test("the home link supports all four site locales", () => {
  const page = read("src/pages/404.astro");

  assert.match(page, /"zh-CN":\s*"返回首页"/);
  assert.match(page, /"zh-TW":\s*"返回首頁"/);
  assert.match(page, /en:\s*"Back home"/);
  assert.match(page, /ja:\s*"ホームへ"/);
  assert.match(page, /stripLocaleFromPath\(Astro\.url\.pathname\)/);
  assert.match(page, /localizePath\("\/", locale\)/);
});

test("the layered 404 asset generator uses guarded gpt-image-2 outputs", () => {
  const generator = read("scripts/generate-404-image.py");

  assert.match(generator, /--asset/);
  assert.match(generator, /choices=\["background", "character", "all"\]/);
  assert.match(generator, /model="gpt-image-2"/);
  assert.match(generator, /OPENAI_IMAGE_BASE_URL/);
  assert.match(generator, /OPENAI_IMAGE_API_KEY/);
  assert.match(generator, /#ff00ff/);
  assert.match(generator, /remove_chroma_key\.py/);
  assert.match(generator, /validate_background\(master\)/);
  assert.match(generator, /validate_character\(master\)/);
  assert.match(generator, /os\.replace\(source, destination\)/);
});

test("the generated 404 raster assets satisfy layout and transparency constraints", () => {
  const output = execFileSync(
    "uv",
    [
      "run",
      "--with",
      "pillow",
      "python",
      "-c",
      `
from pathlib import Path
from PIL import Image

root = Path.cwd() / "public/images"
for name in ["404-background.png", "404-background-1280.webp", "404-background-1920.webp", "404-background-3840.webp"]:
    image = Image.open(root / name)
    assert image.width * 9 == image.height * 16, (name, image.size)

character = Image.open(root / "404-character.png").convert("RGBA")
alpha = character.getchannel("A")
corners = [(0, 0), (character.width - 1, 0), (0, character.height - 1), (character.width - 1, character.height - 1)]
assert all(alpha.getpixel(point) == 0 for point in corners)
visible = sum(alpha.histogram()[1:]) / (character.width * character.height)
assert 0.22 <= visible <= 0.78, visible

logo = Image.open(root / "404-rhine-mark.png").convert("RGBA")
assert logo.width / logo.height > 1.8, logo.size
assert logo.getchannel("A").getbbox() is not None
print("ok")
`,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );

  assert.equal(output.trim(), "ok");
});
