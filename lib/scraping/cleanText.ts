import { load } from "cheerio";

import { PAGE_TEXT_CHAR_LIMIT } from "../config/constants";

export const cleanHtmlToText = (html: string, maxCharacters = PAGE_TEXT_CHAR_LIMIT): string => {
  const $ = load(html);

  $("script, style, noscript, nav, footer, header, svg, iframe, form").remove();

  const bodyText = $("body").text() || $.root().text();
  const normalized = bodyText.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  return normalized.slice(0, maxCharacters);
};
