import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("About photography uses the normal responsive prose image sizing", () => {
  const about = read("src/components/sections/AboutSection.astro");
  const globalStyles = read("src/styles/global.css");

  assert.doesNotMatch(about, /\.about-article__body\s+:global\(img\)\s*\{[^}]*max-height/s);
  assert.match(globalStyles, /\.ui-prose img\s*\{[^}]*max-width:\s*100%[^}]*height:\s*auto/s);
});
