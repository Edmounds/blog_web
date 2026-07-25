import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the native comment system uses the Astro-star composer layout", () => {
  const component = read("src/components/domain/CommentsSection.astro");
  const styles = read("src/styles/global.css");

  assert.match(component, /class="comments-section__header"/);
  assert.match(component, /Notes, questions, and follow-ups are welcome here\./);
  assert.match(component, /class="comments-field comments-field--name"/);
  assert.match(component, /class="comments-list__header"/);
  assert.match(component, /className = "comments-list__avatar"/);
  assert.match(styles, /\.comments-section__header h2[^}]*-webkit-text-stroke:/s);
  assert.match(styles, /\.comments-section__header h2[^}]*font-size:\s*var\(--article-title-size\)/s);
  assert.match(styles, /\.comments-form[^}]*border-radius:\s*var\(--radius-control\)/s);
  assert.match(styles, /\.comments-form__footer button[^}]*border-radius:\s*999px/s);
});
