// The live console. This class joins the controls of the page to the lab, and it draws what the lab recorded.
import { byId, h } from "@mark1russell7/site-pages/chrome";
import { LOG_LEVEL_NAMES, LogLevel, type LogOptions } from "@mark1russell7/logger";
import { Lab, LEVELS, levelName, TRANSPORTS, type CallbackMode, type FormatterId, type LoggerNode, type Trace, type TransportId } from "./lab.ts";
import { pipelineKey, renderPipeline } from "./pipeline.ts";

/** The page shows only this number of rows in each list. */
const ROW_LIMIT = 100;

/** The names that the box for a new child suggests, in sequence. */
const CHILD_NAMES = ["db", "pool", "query", "cache"];

const STARTERS: readonly { readonly level: LogLevel; readonly message: string; readonly options?: LogOptions }[] = [
  { level: LogLevel.ERROR, message: "Payment provider timed out" },
  { level: LogLevel.WARN, message: "Retry 2 of 3" },
  { level: LogLevel.INFO, message: "Order 1042 accepted", options: { data: { orderId: 1042 } } },
  { level: LogLevel.DEBUG, message: "Cache hit for order 1042" },
  { level: LogLevel.TRACE, message: "Entered priceOrder()" },
];

/** This function replaces the rows of a box, and it keeps the focus and the scroll position of the box. */
function replaceRows(box: HTMLElement, rows: readonly Node[], key: string): void {
  const active = document.activeElement;
  const focused = active instanceof HTMLElement && box.contains(active) ? active.dataset[key] : undefined;
  const top = box.scrollTop;
  box.replaceChildren(...rows);
  box.scrollTop = top;
  if (focused !== undefined) box.querySelector<HTMLElement>(`[data-${key}="${focused}"]`)?.focus();
}

/** This function shows the rows of a list, oldest first, and it scrolls to the newest row when the total changes. */
function fillNewestLast(box: HTMLElement, rows: readonly Node[], total: number): void {
  const grew = box.dataset["total"] !== String(total);
  const top = box.scrollTop;
  box.dataset["total"] = String(total);
  box.replaceChildren(...rows);
  box.scrollTop = grew ? box.scrollHeight : top;
}

const levelFor = (name: string | undefined): LogLevel | undefined => LEVELS.find((level) => levelName(level) === name);

export class App {
  private lab: Lab;
  private node: LoggerNode;
  private selected: number | undefined;
  /** True after a send: the next drawing selects the newest record. */
  private follow = false;
  /** True: the next drawing of the path plays. */
  private play = false;
  private drawn = "";
  private children = 0;

  private readonly message = byId<HTMLInputElement>("message");
  private readonly data = byId<HTMLInputElement>("data");
  private readonly withError = byId<HTMLInputElement>("with-error");
  private readonly context = byId<HTMLInputElement>("context");
  private readonly dataError = byId("data-error");
  private readonly childName = byId<HTMLInputElement>("child-name");
  private readonly memoryLevel = byId<HTMLSelectElement>("memory-level");
  private readonly pipeline = byId("pipeline");

  constructor() {
    this.lab = this.newLab();
    this.node = this.lab.root;
    this.wire();
    this.start();
  }

  private newLab(): Lab {
    return new Lab(() => this.render());
  }

  /** The first records show one full path at once, with no click. The INFO record stays selected. */
  private start(): void {
    let shown: Trace | undefined;
    for (const { level, message, options } of STARTERS) {
      const trace = this.lab.emit(this.lab.root, level, message, options);
      if (level === LogLevel.INFO) shown = trace;
    }
    this.selected = shown?.id;
    this.play = true;
    this.childName.value = CHILD_NAMES[0] ?? "";
    this.render();
  }

  private wire(): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>("#emit [data-emit]")) {
      button.addEventListener("click", () => {
        const level = levelFor(button.dataset["emit"]);
        if (level !== undefined) this.send([level]);
      });
    }
    byId("burst").addEventListener("click", () => this.send(LEVELS));
    this.data.addEventListener("input", () => this.readData());

    byId("add-child").addEventListener("click", () => this.addChild());
    this.childName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.addChild();
    });
    byId("tree").addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button[data-node]");
      const node = this.lab.nodes.find((candidate) => String(candidate.id) === button?.dataset["node"]);
      if (node === undefined) return;
      this.node = node;
      this.render();
    });

    for (const button of document.querySelectorAll<HTMLButtonElement>("#level [data-level]")) {
      button.addEventListener("click", () => {
        const level = levelFor(button.dataset["level"]);
        if (level !== undefined) this.lab.setLevel(this.node, level);
      });
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("#formatter [data-formatter]")) {
      button.addEventListener("click", () => this.lab.setFormatter(button.dataset["formatter"] as FormatterId));
    }
    for (const box of document.querySelectorAll<HTMLInputElement>("#transports input[data-transport]")) {
      box.addEventListener("change", () => this.lab.setTransport(this.node, box.dataset["transport"] as TransportId, box.checked));
    }
    byId<HTMLSelectElement>("callback-mode").addEventListener("change", (event) => {
      this.lab.callbackMode = (event.target as HTMLSelectElement).value as CallbackMode;
    });
    byId<HTMLInputElement>("devtools").addEventListener("change", (event) => {
      this.lab.devtools = (event.target as HTMLInputElement).checked;
    });

    byId("flush").addEventListener("click", () => void this.lab.finish(this.node, "flush"));
    byId("close").addEventListener("click", () => void this.lab.finish(this.node, "close"));
    byId("reset").addEventListener("click", () => this.reset());

    byId("records").addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button[data-record]");
      if (button === null) return;
      this.selected = Number(button.dataset["record"]);
      this.render();
    });

    this.memoryLevel.addEventListener("change", () => this.renderMemory());
    byId("memory-clear").addEventListener("click", () => {
      this.lab.memory.clear();
      this.render();
    });
  }

  private reset(): void {
    const mode = byId<HTMLSelectElement>("callback-mode");
    mode.value = "ok";
    byId<HTMLInputElement>("devtools").checked = false;
    this.memoryLevel.value = "all";
    this.children = 0;
    this.lab = this.newLab();
    this.node = this.lab.root;
    this.selected = undefined;
    this.start();
  }

  /** This function reads the data box. It gives `undefined` for an empty box, and `false` for text that is not an object. */
  private readData(): Record<string, unknown> | undefined | false {
    const text = this.data.value.trim();
    let parsed: unknown;
    if (text !== "") {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    const good = text === "" || (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed));
    this.dataError.hidden = good;
    if (!good) return false;
    return text === "" ? undefined : (parsed as Record<string, unknown>);
  }

  private send(levels: readonly LogLevel[]): void {
    const data = this.readData();
    if (data === false) {
      byId<HTMLDetailsElement>("more").open = true;
      this.data.focus();
      return;
    }
    const context = this.context.value.trim();
    const options: LogOptions = {
      ...(data === undefined ? {} : { data }),
      ...(this.withError.checked ? { error: new Error("Connection refused") } : {}),
      ...(context === "" ? {} : { context }),
    };
    const message = this.message.value.trim() || "Hello";
    for (const level of levels) {
      this.follow = true;
      this.play = true;
      this.lab.emit(this.node, level, message, options);
    }
  }

  private addChild(): void {
    const name = this.childName.value.trim();
    if (name === "") {
      this.childName.focus();
      return;
    }
    this.node = this.lab.addChild(this.node, name);
    this.children++;
    this.childName.value = CHILD_NAMES[this.children] ?? "";
    this.render();
  }

  private render(): void {
    const animate = this.play;
    if (this.follow) this.selected = this.lab.traces[0]?.id;
    this.follow = false;
    this.play = false;

    const trace = this.lab.traces.find((candidate) => candidate.id === this.selected);
    const key = pipelineKey(trace);
    if (animate || key !== this.drawn) {
      renderPipeline(this.pipeline, trace, animate);
      this.drawn = key;
    }

    this.renderTree();
    this.renderControls();
    this.renderRecords();
    this.renderConsole();
    this.renderMemory();
    this.renderCallback();
    this.renderBatch();
    this.renderFailures();
    this.renderLifecycle();
    this.renderCalls();
  }

  private renderTree(): void {
    const rows = this.lab.nodes.map((node) =>
      h(
        "li",
        { style: `--depth:${String(node.depth)}` },
        h(
          "button",
          { type: "button", class: "node", "data-node": String(node.id), "aria-pressed": node === this.node ? "true" : "false" },
          h("span", { class: "node-name" }, node.context),
          h("span", { class: "node-level" }, LOG_LEVEL_NAMES[node.logger.getLevel()]),
        ),
      ),
    );
    replaceRows(byId("tree"), rows, "node");
  }

  private renderControls(): void {
    const level = this.node.logger.getLevel();
    for (const button of document.querySelectorAll<HTMLButtonElement>("#level [data-level]")) {
      button.setAttribute("aria-pressed", String(button.dataset["level"] === levelName(level)));
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("#formatter [data-formatter]")) {
      button.setAttribute("aria-pressed", String(button.dataset["formatter"] === this.lab.formatterId));
    }
    for (const box of document.querySelectorAll<HTMLInputElement>("#transports input[data-transport]")) {
      box.checked = this.node.attached.has(box.dataset["transport"] as TransportId);
    }
    byId("level-of").textContent = this.node.context;
    byId("transports-of").textContent = this.node.context;
    byId("finish-of").textContent = this.node.context;
    for (const id of ["flush", "close"]) byId<HTMLButtonElement>(id).disabled = this.lab.busy !== undefined;
    for (const id of TRANSPORTS) {
      const holders = this.lab.nodes.filter((node) => node.attached.has(id)).map((node) => node.context);
      byId(`${id}-on`).textContent = holders.length === 0 ? "On no logger." : `On ${holders.join(", ")}.`;
    }
  }

  private renderRecords(): void {
    const { traces } = this.lab;
    const rows = traces.slice(0, ROW_LIMIT).map((trace) => {
      const outcome = trace.passed ? "passed" : "dropped";
      return h(
        "li",
        { class: `record l-${levelName(trace.level)}`, "data-id": String(trace.id), "data-level": levelName(trace.level), "data-outcome": outcome },
        h(
          "button",
          { type: "button", "data-record": String(trace.id), "aria-pressed": trace.id === this.selected ? "true" : "false" },
          h("span", { class: "record-level" }, LOG_LEVEL_NAMES[trace.level]),
          h("span", { class: "record-text" }, trace.message),
          h("span", { class: "record-logger" }, trace.logger),
          h("span", { class: "record-outcome" }, trace.passed ? "Passed" : "Dropped"),
        ),
      );
    });
    replaceRows(byId("records"), rows, "record");
    byId("stat-sent").textContent = String(this.lab.sent);
    byId("stat-passed").textContent = String(this.lab.passed);
    byId("stat-dropped").textContent = String(this.lab.dropped);
    byId("stat-failed").textContent = String(this.lab.failures.length);
  }

  private renderConsole(): void {
    const { consoleLines } = this.lab;
    const rows = consoleLines
      .slice(-ROW_LIMIT)
      .map((line) => h("li", { class: `l-${line.method}`, "data-method": line.method }, h("span", { class: "method" }, `console.${line.method}`), h("span", { class: "text" }, line.text)));
    fillNewestLast(byId("console-lines"), rows, consoleLines.length);
  }

  private renderMemory(): void {
    const { memory } = this.lab;
    const level = levelFor(this.memoryLevel.value);
    const entries = level === undefined ? memory.entries : memory.getEntries(level);
    byId("memory-count").textContent = String(entries.length);
    const rows = entries
      .slice(-ROW_LIMIT)
      .map((entry) =>
        h("li", { class: `l-${levelName(entry.level)}`, "data-level": levelName(entry.level) }, h("span", { class: "method" }, LOG_LEVEL_NAMES[entry.level]), h("span", { class: "text" }, entry.message)),
      );
    fillNewestLast(byId("memory-rows"), rows, entries.length);
  }

  private renderCallback(): void {
    const { callbackCalls } = this.lab;
    const rows = callbackCalls.slice(-ROW_LIMIT).map((call) => h("li", { class: `l-${levelName(call.entry.level)}` }, h("span", { class: "text" }, call.formatted)));
    fillNewestLast(byId("callback-rows"), rows, callbackCalls.length);
  }

  private renderBatch(): void {
    const { batch } = this.lab;
    byId("batch-state").textContent = batch.isClosed ? "Closed" : this.lab.busy === undefined ? "Open" : "Sending";
    byId("batch-state").dataset["state"] = batch.isClosed ? "closed" : "open";
    byId("batch-pending").replaceChildren(...batch.pending.slice(-ROW_LIMIT).map((line) => h("li", {}, h("span", { class: "text" }, line))));
    byId("batch-sent").replaceChildren(
      ...batch.sent.slice(-ROW_LIMIT).map((sent, index) => h("li", {}, h("span", { class: "method" }, `Batch ${String(index + 1)}`), h("span", { class: "text" }, `${String(sent.lines.length)} lines at ${sent.at.toISOString().slice(11, 19)}`))),
    );
  }

  private renderFailures(): void {
    const box = byId("transport-errors");
    const { failures } = this.lab;
    box.hidden = failures.length === 0;
    byId("failure-rows").replaceChildren(...failures.slice(0, 20).map((failure) => h("li", {}, h("strong", {}, failure.transport), ` ${failure.message}`)));
  }

  private renderLifecycle(): void {
    const { busy, lifecycle } = this.lab;
    const box = byId("lifecycle");
    if (busy !== undefined) {
      box.textContent = `The ${busy} call waits for its transports.`;
      return;
    }
    if (lifecycle === undefined) {
      box.textContent = "";
      return;
    }
    const callers = lifecycle.with.length === 0 ? "No transport on this logger has this method." : `It called ${lifecycle.with.join(", ")}.`;
    const skipped = lifecycle.without.length === 0 ? "" : ` It skipped ${lifecycle.without.join(", ")}: the method is not there.`;
    const lines = lifecycle.with.includes("batch") ? ` ${String(lifecycle.lines)} lines left the buffer.` : "";
    const failed = lifecycle.error === undefined ? "" : ` It failed: ${lifecycle.error}`;
    box.textContent = `${lifecycle.logger}.${lifecycle.action}() took ${String(lifecycle.ms)} ms. ${callers}${skipped}${lines}${failed}`;
  }

  private renderCalls(): void {
    byId("calls").replaceChildren(...this.lab.calls.map((call) => h("li", {}, h("code", {}, call))));
  }
}
