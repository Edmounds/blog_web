import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the native comment system uses the Astro-star composer layout", () => {
  const component = read("src/components/domain/CommentsSection.astro");
  const styles = read("src/styles/global.css");

  assert.match(component, /class="comments-section__header"/);
  assert.doesNotMatch(component, /欢迎在这里留下笔记|Notes, questions, and follow-ups|歡迎在這裡留下筆記|メモ、質問/);
  assert.doesNotMatch(component, /const descriptions/);
  assert.match(component, /class="comments-form__identity"/);
  assert.match(component, /id="comment-name"/);
  assert.match(component, /id="comment-content"/);
  assert.match(component, /data-content-count/);
  assert.match(component, /data-submit/);
  assert.doesNotMatch(component, /id="comment-email"/);
  assert.doesNotMatch(component, /id="comment-url"/);
  assert.doesNotMatch(component, /comments-form__tools/);
  assert.doesNotMatch(component, /lucide-static|<Icon/);
  assert.match(component, /id="comment-website" name="website"/);
  assert.match(component, /JSON\.stringify\(\{ contentId, name: name\.value, content: content\.value, website: website\.value \}\)/);
  assert.doesNotMatch(component, /comments-form__login/);
  assert.match(component, /class="comments-list__header"/);
  assert.match(component, /className = "comments-list__avatar"/);
  assert.match(styles, /\.comments-section__header h2[^}]*-webkit-text-stroke:/s);
  assert.match(styles, /\.comments-section__header h2[^}]*font-size:\s*var\(--type-xl\)/s);
  assert.doesNotMatch(styles, /\.comments-section__header p/);
  assert.match(styles, /\.comments-form[^}]*border-radius:\s*0\.5rem/s);
  assert.match(styles, /\.comments-form__identity[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(styles, /\.comments-form__footer[^}]*justify-content:\s*flex-end/s);
  assert.match(styles, /\.comments-form__footer button[^}]*color:\s*var\(--canvas\)[^}]*background:\s*color-mix\(in srgb, var\(--foreground\)/s);
  assert.doesNotMatch(styles, /\.comments-form__tools/);
  assert.match(styles, /\.comments-form__footer button[^}]*border-radius:\s*999px/s);
});
