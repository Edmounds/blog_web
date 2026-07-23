import sourceMessages from "../i18n/source.json";
import { defaultLocale, type Locale } from "./i18n";

type Messages = typeof sourceMessages;

const modules = import.meta.glob<{ default: Messages }>("../i18n/generated/*.json", { eager: true });
const generated = new Map<Locale, Messages>();

for (const [path, module] of Object.entries(modules)) {
  const locale = path.split("/").pop()?.replace(/\.json$/, "") as Locale | undefined;
  if (locale) generated.set(locale, module.default);
}

export const getMessages = (locale: Locale = defaultLocale): Messages =>
  locale === defaultLocale ? sourceMessages : generated.get(locale) ?? sourceMessages;

export type { Messages };

