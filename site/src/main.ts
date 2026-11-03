// The start of the page: the theme, the live console, the API table and the build line.
import { byId, copyText, h, setupTheme } from "@mark1russell7/site-pages/chrome";
import "@mark1russell7/site-pages/scroll-cue.css";
import { API, result } from "./api.ts";
import { App } from "./app.ts";
import batchSource from "./batch-transport.ts?raw";
import "./style.css";

setupTheme(byId<HTMLButtonElement>("theme"), "logger-theme");
new App();

byId("batch-source").textContent = batchSource.trimEnd();

/** This function shows the words in backticks as code. */
const prose = (text: string) => text.split("`").map((part, index) => (index % 2 === 1 ? h("code", {}, part) : part));

byId("api-rows").replaceChildren(
  ...API.map((row) =>
    h(
      "tr",
      {},
      h("td", { "data-label": "Name" }, ...row.names.map((name) => h("code", { class: "name" }, name))),
      h("td", { "data-label": "What it does" }, ...prose(row.what)),
      h("td", { class: "live", "data-label": "Live result" }, ...row.examples.map((example) => h("div", { class: "ex" }, h("code", {}, example.code), h("output", {}, result(example))))),
    ),
  ),
);

for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
  button.addEventListener("click", () => void copyText(button, byId(button.dataset["copy"] ?? "").textContent ?? ""));
}

byId("build").append(
  `Version ${__BUILD__.version}, build `,
  __BUILD__.sha === "local" ? "local" : h("a", { href: `https://github.com/mark1russell7/Logger/commit/${__BUILD__.sha}` }, __BUILD__.sha),
  ` of ${__BUILD__.date}`,
);
