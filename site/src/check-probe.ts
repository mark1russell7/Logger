/**
 * The probe of the live console. The site check of the Pages workflow starts it in a browser at each width, before the
 * deploy. A failed check stops the deploy.
 *
 * The site check reads this TypeScript file directly. It removes the types and the `export` line, and it starts the
 * result as the body of an async function.
 */

// The site check gives these helpers to the probe. Each element of this page is an HTML element.
declare const check: (name: string, ok: unknown, detail?: unknown) => boolean;
declare const until: <T>(fn: () => T | Promise<T>, ms?: number) => Promise<T>;
declare const $: (selector: string) => HTMLElement | null;
declare const $$: (selector: string) => HTMLElement[];
declare const type: (target: string | Element, text: string) => void;
declare const click: (target: string | Element) => void;

const text = (selector: string) => $(selector)?.textContent ?? "";
const records = () => $$("#records li");
const newest = () => records()[0];
const consoleTexts = () => $$("#console-lines .text").map((line) => line.textContent ?? "");
const lastConsole = () => consoleTexts().at(-1) ?? "";
const lane = (id: string) => $(`#pipeline [data-lane="${id}"]`);
const outcome = () => $("#pipeline")?.dataset["outcome"];
const emit = (level: string) => click(`#emit [data-emit="${level}"]`);
const level = (name: string) => click(`#level [data-level="${name}"]`);
const transport = (name: string) => click(`#transports input[data-transport="${name}"]`);
const selectValue = (selector: string, value: string) => {
  const box = $(selector) as HTMLSelectElement;
  box.value = value;
  box.dispatchEvent(new Event("change", { bubbles: true }));
};

// The first view.
check("the page starts with five records", await until(() => records().length === 5), records().length);
check("the real logger passed three records and dropped two", text("#stat-passed") === "3" && text("#stat-dropped") === "2", `${text("#stat-passed")} passed, ${text("#stat-dropped")} dropped`);
check(
  "the dropped records are DEBUG and TRACE",
  records().filter((row) => row.dataset["outcome"] === "dropped").map((row) => row.dataset["level"]).sort().join() === "debug,trace",
  records().map((row) => `${row.dataset["level"]}=${row.dataset["outcome"]}`).join(),
);
check("the console shows the real text of the simple formatter", consoleTexts().length === 3 && consoleTexts()[0] === "[ERROR] [app] Payment provider timed out", consoleTexts().join(" | "));
check("the memory transport has three entries", text("#memory-count") === "3", text("#memory-count"));
check("the first path shows the INFO record", outcome() === "passed" && (lane("console")?.dataset["state"] === "done"), outcome());

// A dropped record stops at the filter.
click(records().find((row) => row.dataset["level"] === "debug")?.querySelector("button") as HTMLElement);
check("a dropped record stops at the filter", await until(() => outcome() === "dropped"), outcome());
check("a dropped record reaches no transport", $$("#pipeline [data-lane]").length === 2 && $$("#pipeline [data-lane]").every((row) => row.dataset["state"] === "unreached"), $$("#pipeline [data-lane]").map((row) => row.dataset["state"]).join());
check("a dropped record has no entry", text('#pipeline [data-stage="entry"]').includes("No entry"), text('#pipeline [data-stage="entry"]'));
check("the filter shows the real comparison", text("#comparison").includes("DEBUG 3 > INFO 2"), text("#comparison"));

// The visitor sends a record.
type("#message", "Probe message");
const linesBefore = consoleTexts().length;
emit("debug");
check("a DEBUG record at INFO is dropped", await until(() => outcome() === "dropped" && newest()?.dataset["level"] === "debug"), newest()?.dataset["outcome"]);
check("a dropped record writes no console line", consoleTexts().length === linesBefore, consoleTexts().length);

level("trace");
check("the level button reports the new level", await until(() => $('#level [data-level="trace"]')?.getAttribute("aria-pressed") === "true"));
emit("debug");
check("the same record passes at TRACE", await until(() => lastConsole() === "[DEBUG] [app] Probe message"), lastConsole());
check("the filter shows the second comparison", text("#comparison").includes("DEBUG 3 <= TRACE 4"), text("#comparison"));

// The formatters.
click('#formatter [data-formatter="json"]');
type("#data", '{"orderId":42}');
emit("warn");
check("the JSON formatter writes one parsable line", await until(() => lastConsole().startsWith("{")), lastConsole());
const parsed = JSON.parse(lastConsole()) as { level?: string; message?: string; data?: { orderId?: number } };
check("the JSON line holds the level, the message and the data", parsed.level === "WARN" && parsed.message === "Probe message" && parsed.data?.orderId === 42, lastConsole());
check("the WARN record used console.warn", $$("#console-lines li").at(-1)?.dataset["method"] === "warn", $$("#console-lines li").at(-1)?.dataset["method"]);

type("#data", "not json");
const sentBefore = text("#stat-sent");
emit("info");
check("bad data stops the send and shows the problem", await until(() => $("#data-error")?.hidden === false) && text("#stat-sent") === sentBefore, text("#stat-sent"));
type("#data", "");

click('#formatter [data-formatter="timestamped"]');
emit("info");
check("the timestamped formatter writes an ISO time", await until(() => /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[app\] Probe message$/.test(lastConsole())), lastConsole());
click('#formatter [data-formatter="simple"]');

// The child loggers.
click("#add-child");
check("the first child joins the tree", await until(() => $$("#tree button").length === 2), $$("#tree button").length);
emit("info");
check("the child adds its context to the real output", await until(() => lastConsole() === "[INFO] [app:db] Probe message"), lastConsole());
click("#add-child");
await until(() => $$("#tree button").length === 3);
emit("debug");
check("the nested child has the context app:db:pool", await until(() => lastConsole() === "[DEBUG] [app:db:pool] Probe message"), lastConsole());

click($$("#tree button")[0] as HTMLElement);
await until(() => text("#level-of") === "app");
level("error");
await until(() => $('#level [data-level="error"]')?.getAttribute("aria-pressed") === "true");
check("a level on the root leaves the child at TRACE", ($$("#tree .node-level")[2]?.textContent ?? "") === "TRACE" && ($$("#tree .node-level")[0]?.textContent ?? "") === "ERROR", $$("#tree .node-level").map((row) => row.textContent).join());
level("trace");
await until(() => $('#level [data-level="trace"]')?.getAttribute("aria-pressed") === "true");

// The callback transport.
transport("callback");
await until(() => ($("#callback-on")?.textContent ?? "").includes("app"));
emit("info");
check("a new transport gets a lane", await until(() => lane("callback")?.dataset["state"] === "done"), lane("callback")?.dataset["state"]);
check("the callback got the record", await until(() => $$("#callback-rows li").length === 1), $$("#callback-rows li").length);

selectValue("#callback-mode", "rejects");
emit("info");
check("a rejected callback goes to onTransportError", await until(() => $("#transport-errors")?.hidden === false && lane("callback")?.dataset["state"] === "failed"), lane("callback")?.dataset["state"]);
check("the other transports still got the record", lane("console")?.dataset["state"] === "done" && lane("memory")?.dataset["state"] === "done", lane("console")?.dataset["state"]);
check("the failure names the transport", text("#failure-rows").includes("callback") && text("#failure-rows").includes("rejected"), text("#failure-rows"));
selectValue("#callback-mode", "ok");

// The memory transport.
selectValue("#memory-level", "debug");
check("the memory filter calls the real getEntries", await until(() => $$("#memory-rows li").length > 0 && $$("#memory-rows li").every((row) => row.dataset["level"] === "debug")), $$("#memory-rows li").length);
selectValue("#memory-level", "all");
click("#memory-clear");
check("the real clear empties the memory", await until(() => text("#memory-count") === "0"), text("#memory-count"));

// Flush and close.
transport("batch");
await until(() => ($("#batch-on")?.textContent ?? "").includes("app"));
emit("info");
emit("warn");
check("the batch transport holds two lines", await until(() => $$("#batch-pending li").length === 2), $$("#batch-pending li").length);
click("#flush");
check("a flush sends one batch", await until(() => $$("#batch-pending li").length === 0 && $$("#batch-sent li").length === 1), $$("#batch-sent li").length);
check("the flush reports two lines", await until(() => text("#lifecycle").includes("2 lines left the buffer")), text("#lifecycle"));
click("#close");
check("a close closes the batch transport", await until(() => text("#batch-state") === "Closed" && !($("#close") as HTMLButtonElement).disabled), text("#batch-state"));
const consoleCount = consoleTexts().length;
emit("info");
check("a write after the close fails, and the logger stays open", await until(() => lane("batch")?.dataset["state"] === "failed" && consoleTexts().length === consoleCount + 1), lane("batch")?.dataset["state"]);

// A logger with no transports.
transport("console");
await until(() => !($('#transports input[data-transport="console"]') as HTMLInputElement).checked);
emit("info");
check("a removed transport has no lane", await until(() => lane("console") === null && lane("memory") !== null));
transport("memory");
transport("callback");
transport("batch");
await until(() => $$("#transports input:checked").length === 0);
emit("info");
check("a logger with no transports sends the record nowhere", await until(() => $("#no-transports") !== null && outcome() === "passed"), outcome());

// The rest of the page.
check("the API table has only real results", $$("#api-rows tr").length === 13 && $$("#api-rows output").length >= 16 && $$("#api-rows output").every((output) => (output.textContent ?? "") !== "" && !(output.textContent ?? "").startsWith("throws")), `${$$("#api-rows tr").length} rows, ${$$("#api-rows output").length} outputs`);
check("the page shows the source of the batch transport", text("#batch-source").includes("implements Transport"), text("#batch-source").slice(0, 80));

click("#reset");
check("Start again gives a new logger", await until(() => records().length === 5 && $$("#tree button").length === 1 && text("#batch-state") === "Open" && text("#stat-failed") === "0"), records().length);

export {};
