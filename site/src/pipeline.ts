// The picture of one record on its path through the logger: the call, the level filter, the entry and the transports.
import { h } from "@mark1russell7/site-pages/chrome";
import { LOG_LEVEL_NAMES, LogLevel } from "@mark1russell7/logger";
import { FORMATTERS, LEVELS, levelName, plainEntry, type Delivery, type Trace, type TransportId } from "./lab.ts";

/** This function gives the name and the number of a level, for example `INFO 2`. */
const named = (level: LogLevel): string => `${LOG_LEVEL_NAMES[level]} ${String(level)}`;

const wire = (index: number, live: boolean) =>
  h("div", { class: `wire wire-${String(index)}${live ? "" : " cut"}`, style: `--i:${String(index)}`, "aria-hidden": "true" }, h("i", {}));

function callStage(trace: Trace) {
  return h(
    "div",
    { class: `stage l-${levelName(trace.level)}`, "data-stage": "call", style: "--i:0" },
    h("h3", {}, "The call"),
    h("pre", { class: "scroll-cue" }, h("code", {}, trace.call)),
    h("p", { class: "hint" }, `Context: ${trace.logger}`),
  );
}

/** The filter is one ladder of the five levels. The record lands on its own rung, above or below the level of the logger. */
function filterStage(trace: Trace) {
  const rungs = LEVELS.map((level) =>
    h(
      "li",
      {
        class: `rung l-${levelName(level)}`,
        "data-rung": levelName(level),
        "data-side": level > trace.threshold ? "below" : "above",
        "data-threshold": level === trace.threshold ? "true" : undefined,
        "data-here": level === trace.level ? "true" : undefined,
      },
      h("span", { class: "rung-name" }, LOG_LEVEL_NAMES[level]),
      level === trace.threshold ? h("span", { class: "rung-note" }, "logger") : null,
      level === trace.level ? h("span", { class: "dot", "aria-label": "This record" }) : null,
    ),
  );
  const comparison = trace.passed ? `${named(trace.level)} <= ${named(trace.threshold)}` : `${named(trace.level)} > ${named(trace.threshold)}`;
  return h(
    "div",
    { class: "stage", "data-stage": "filter", style: "--i:1" },
    h("h3", {}, "The level filter"),
    h("ol", { class: "ladder" }, rungs),
    h("p", { id: "comparison", class: "verdict" }, h("strong", {}, trace.passed ? "Passed" : "Dropped"), " ", h("code", {}, comparison)),
  );
}

function entryStage(trace: Trace) {
  const stage = h("div", { class: "stage", "data-stage": "entry", style: "--i:2" }, h("h3", {}, "The entry"));
  if (trace.entry === undefined) {
    stage.append(h("p", { class: "hint" }, "No entry. ", h("code", {}, "Logger.log"), " returned before it made one."));
    return stage;
  }
  const rows = Object.entries(plainEntry(trace.entry)).map(([key, value]) =>
    h("div", { class: "field" }, h("dt", {}, key), h("dd", {}, typeof value === "string" ? value : JSON.stringify(value))),
  );
  stage.append(h("dl", { class: "fields" }, rows));
  return stage;
}

function laneState(trace: Trace, delivery: Delivery | undefined): string {
  if (!trace.passed) return "unreached";
  return delivery?.state ?? "unreached";
}

const STATE_TEXT: Record<string, string> = {
  done: "Delivered",
  pending: "Waiting for the promise",
  failed: "Failed",
  unreached: "Not reached",
};

function lane(trace: Trace, id: TransportId, index: number) {
  const delivery = trace.deliveries.find((candidate) => candidate.transport === id);
  const state = laneState(trace, delivery);
  const reached = state !== "unreached";
  const formatter = id === "memory" ? "No formatter" : FORMATTERS[trace.formatter].className;
  return h(
    "li",
    { class: "lane", "data-lane": id, "data-state": state, style: `--i:${String(3 + index)}` },
    h(
      "div",
      { class: "lane-head" },
      h("strong", {}, id),
      h("span", { class: "chip", "data-formatter-chip": id }, reached ? formatter : ""),
      h("span", { class: "state" }, STATE_TEXT[state]),
    ),
    reached && delivery?.where !== undefined ? h("p", { class: "where" }, h("code", {}, delivery.where)) : null,
    reached && delivery?.formatted !== undefined ? h("pre", { class: "line" }, delivery.formatted) : null,
    reached && id === "memory" && delivery?.state === "done" ? h("p", { class: "hint" }, "This transport keeps the entry as it is, with no text.") : null,
    delivery?.error === undefined ? null : h("p", { class: "lane-error" }, delivery.error),
  );
}

function transportsStage(trace: Trace) {
  const stage = h("div", { class: "stage lanes-stage", "data-stage": "transports", style: "--i:3" }, h("h3", {}, "The transports"));
  if (trace.attached.length === 0) {
    stage.append(h("p", { id: "no-transports", class: "hint" }, "This logger has no transports, so the record goes nowhere."));
    return stage;
  }
  stage.append(h("ol", { class: "lanes" }, trace.attached.map((id, index) => lane(trace, id, index))));
  return stage;
}

/** This function gives a text that changes when the picture of the record changes. */
export const pipelineKey = (trace: Trace | undefined): string =>
  trace === undefined ? "none" : `${String(trace.id)}:${trace.deliveries.map((delivery) => `${delivery.transport}=${delivery.state}`).join()}`;

/** This function draws the record in the box. The drawing plays once only when `animate` is true. */
export function renderPipeline(box: HTMLElement, trace: Trace | undefined, animate: boolean): void {
  if (trace === undefined) {
    box.removeAttribute("data-outcome");
    box.removeAttribute("data-record");
    box.replaceChildren(h("p", { class: "hint" }, "Send a record to see its path."));
    return;
  }
  box.dataset["outcome"] = trace.passed ? "passed" : "dropped";
  box.dataset["record"] = String(trace.id);
  box.classList.toggle("still", !animate);
  box.replaceChildren(
    h(
      "div",
      { class: "flow" },
      callStage(trace),
      wire(0, true),
      filterStage(trace),
      wire(1, trace.passed),
      entryStage(trace),
      wire(2, trace.passed),
      transportsStage(trace),
    ),
  );
}
