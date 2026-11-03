import { LogLevel } from "@mark1russell7/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API, result } from "./api.ts";
import { captureConsole, Lab, plainEntry } from "./lab.ts";

const fast = () => new Lab(() => {}, { batchSendMs: 1, slowCallbackMs: 1 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a write that fails at once", () => {
  it("reports the change after the record exists", async () => {
    const newest: (string | undefined)[] = [];
    let watching = false;
    const lab = new Lab(() => {
      if (watching) newest.push(lab.traces[0]?.message);
    }, { batchSendMs: 1, slowCallbackMs: 1 });
    lab.setTransport(lab.root, "batch", true);
    await lab.finish(lab.root, "close");
    watching = true;

    const trace = lab.emit(lab.root, LogLevel.INFO, "After the close");

    expect(trace.deliveries.find((delivery) => delivery.transport === "batch")?.state).toBe("failed");
    expect(lab.failures[0]?.transport).toBe("batch");
    expect(newest).toEqual(["After the close"]);
  });
});

describe("the filter", () => {
  it("records a pass only when the real logger calls the tap", () => {
    const lab = fast();
    const passed = lab.emit(lab.root, LogLevel.WARN, "Kept");
    const dropped = lab.emit(lab.root, LogLevel.DEBUG, "Lost");

    expect(passed.passed).toBe(true);
    expect(passed.entry?.message).toBe("Kept");
    expect(dropped.passed).toBe(false);
    expect(dropped.entry).toBeUndefined();
    expect(dropped.deliveries).toEqual([]);
    expect([lab.sent, lab.passed, lab.dropped]).toEqual([2, 1, 1]);
  });

  it("follows setLevel", () => {
    const lab = fast();
    lab.setLevel(lab.root, LogLevel.TRACE);
    expect(lab.emit(lab.root, LogLevel.TRACE, "Now kept").passed).toBe(true);
    expect(lab.emit(lab.root, LogLevel.TRACE, "Now kept").threshold).toBe(LogLevel.TRACE);
  });
});

describe("the formatters", () => {
  it("changes the text of the next records on a running logger", () => {
    const lab = fast();
    expect(lab.emit(lab.root, LogLevel.INFO, "One").deliveries[0]?.formatted).toBe("[INFO] [app] One");

    lab.setFormatter("json");
    const parsed = JSON.parse(lab.emit(lab.root, LogLevel.INFO, "Two", { data: { id: 7 } }).deliveries[0]?.formatted ?? "") as Record<string, unknown>;
    expect(parsed).toMatchObject({ level: "INFO", message: "Two", context: "app", data: { id: 7 } });

    lab.setFormatter("timestamped");
    expect(lab.emit(lab.root, LogLevel.INFO, "Three").deliveries[0]?.formatted).toMatch(/^\[\d{4}-\d{2}-\d{2}T[^\]]+Z\] \[INFO\] \[app\] Three$/);
  });

  it("keeps the formatter after a call of child()", () => {
    const lab = fast();
    lab.setFormatter("json");
    lab.addChild(lab.root, "db");
    expect(() => JSON.parse(lab.emit(lab.root, LogLevel.INFO, "Still JSON").deliveries[0]?.formatted ?? "")).not.toThrow();
  });

  it("gives no text to the memory transport", () => {
    const lab = fast();
    const memory = lab.emit(lab.root, LogLevel.INFO, "Kept").deliveries.find((delivery) => delivery.transport === "memory");
    expect(memory?.formatted).toBeUndefined();
    expect(memory?.where).toBe("entries[0]");
  });
});

describe("the child loggers", () => {
  it("nests the context, and copies the level once", () => {
    const lab = fast();
    lab.setLevel(lab.root, LogLevel.TRACE);
    const db = lab.addChild(lab.root, "db");
    const pool = lab.addChild(db, "pool");
    lab.setLevel(lab.root, LogLevel.ERROR);

    expect(lab.nodes.map((node) => node.context)).toEqual(["app", "app:db", "app:db:pool"]);
    expect(pool.logger.getLevel()).toBe(LogLevel.TRACE);
    expect(lab.emit(pool, LogLevel.DEBUG, "Deep").entry?.context).toBe("app:db:pool");
    expect(lab.emit(lab.root, LogLevel.DEBUG, "Lost").passed).toBe(false);
  });

  it("places a second child after the descendants of the first child", () => {
    const lab = fast();
    const db = lab.addChild(lab.root, "db");
    lab.addChild(db, "pool");
    lab.addChild(lab.root, "cache");
    expect(lab.nodes.map((node) => node.context)).toEqual(["app", "app:db", "app:db:pool", "app:cache"]);
  });

  it("gives a child only the transports of its parent at the time of the call", () => {
    const lab = fast();
    const db = lab.addChild(lab.root, "db");
    lab.setTransport(lab.root, "callback", true);

    expect(lab.emit(db, LogLevel.INFO, "Child").deliveries.map((delivery) => delivery.transport)).toEqual(["console", "memory"]);
    expect(lab.emit(lab.root, LogLevel.INFO, "Root").deliveries.map((delivery) => delivery.transport)).toEqual(["console", "memory", "callback"]);
    expect(lab.callbackCalls).toHaveLength(1);
  });
});

describe("the console transport", () => {
  it("catches the real calls, and restores the console", () => {
    const original = console.error;
    const lab = fast();
    const delivery = lab.emit(lab.root, LogLevel.ERROR, "Stop").deliveries[0];

    expect(lab.consoleLines).toEqual([{ method: "error", text: "[ERROR] [app] Stop" }]);
    expect(delivery?.where).toBe("console.error");
    expect(console.error).toBe(original);
  });

  it("sends nothing to the real console by default", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureConsole(() => console.error("Hidden"), false);
    expect(spy).not.toHaveBeenCalled();
    captureConsole(() => console.error("Shown"), true);
    expect(spy).toHaveBeenCalledWith("Shown");
  });
});

describe("the failures", () => {
  it("reports a throw through onTransportError, and the next transport still runs", () => {
    const lab = fast();
    lab.setTransport(lab.root, "memory", false);
    lab.setTransport(lab.root, "callback", true);
    lab.setTransport(lab.root, "memory", true);
    lab.callbackMode = "throws";
    const trace = lab.emit(lab.root, LogLevel.INFO, "Hello");

    expect(trace.deliveries.map((delivery) => [delivery.transport, delivery.state])).toEqual([
      ["console", "done"],
      ["callback", "failed"],
      ["memory", "done"],
    ]);
    expect(lab.failures).toEqual([{ transport: "callback", message: "The callback threw this error." }]);
  });

  it("reports a rejected promise after the call returns", async () => {
    const lab = fast();
    lab.setTransport(lab.root, "callback", true);
    lab.callbackMode = "rejects";
    const delivery = lab.emit(lab.root, LogLevel.INFO, "Hello").deliveries.at(-1);
    expect(delivery?.state).toBe("pending");
    await vi.waitFor(() => expect(lab.failures).toHaveLength(1));
    expect(delivery?.state).toBe("failed");
  });

  it("finishes a slow callback after the call returns", async () => {
    const lab = fast();
    lab.setTransport(lab.root, "callback", true);
    lab.callbackMode = "slow";
    const delivery = lab.emit(lab.root, LogLevel.INFO, "Hello").deliveries.at(-1);
    expect(delivery?.state).toBe("pending");
    await vi.waitFor(() => expect(delivery?.state).toBe("done"));
    expect(lab.callbackCalls).toHaveLength(1);
  });
});

describe("flush and close", () => {
  it("sends the batch through Logger.flush", async () => {
    const lab = fast();
    lab.setTransport(lab.root, "batch", true);
    lab.emit(lab.root, LogLevel.INFO, "One");
    lab.emit(lab.root, LogLevel.INFO, "Two");
    expect(lab.batch.pending).toHaveLength(2);

    const result = await lab.finish(lab.root, "flush");

    expect(lab.batch.pending).toEqual([]);
    expect(lab.batch.sent[0]?.lines).toEqual(["[INFO] [app] One", "[INFO] [app] Two"]);
    expect(result).toMatchObject({ action: "flush", with: ["batch"], without: ["console", "memory"], lines: 2 });
  });

  it("closes the batch, and a later write fails but the other transports run", async () => {
    const lab = fast();
    lab.setTransport(lab.root, "batch", true);
    await lab.finish(lab.root, "close");
    const trace = lab.emit(lab.root, LogLevel.INFO, "Late");

    expect(lab.batch.isClosed).toBe(true);
    expect(trace.deliveries.map((delivery) => delivery.state)).toEqual(["done", "done", "failed"]);
    expect(lab.failures[0]).toEqual({ transport: "batch", message: "The batch transport is closed." });
  });

  it("does nothing for a logger with only the built-in transports", async () => {
    const lab = fast();
    expect(await lab.finish(lab.root, "flush")).toMatchObject({ with: [], without: ["console", "memory"], lines: 0 });
  });
});

describe("the transports", () => {
  it("removes a transport from the real logger", () => {
    const lab = fast();
    lab.setTransport(lab.root, "console", false);
    expect(lab.emit(lab.root, LogLevel.INFO, "Hello").deliveries.map((delivery) => delivery.transport)).toEqual(["memory"]);
    lab.setTransport(lab.root, "memory", false);
    const trace = lab.emit(lab.root, LogLevel.INFO, "Nowhere");
    expect(trace.passed).toBe(true);
    expect(trace.deliveries).toEqual([]);
  });
});

describe("the helpers", () => {
  it("gives an error as plain values", () => {
    const lab = fast();
    const entry = lab.emit(lab.root, LogLevel.ERROR, "Failed", { error: new TypeError("Bad") }).entry;
    expect(entry && plainEntry(entry)).toMatchObject({ error: { name: "TypeError", message: "Bad" } });
  });

  it("writes each call as code", () => {
    const lab = fast();
    lab.emit(lab.root, LogLevel.INFO, "Hello", { data: { id: 1 } });
    expect(lab.calls[0]).toBe('app.info("Hello", { data: {"id":1} })');
  });
});

describe("the API table", () => {
  it("has a result for each example, and no example throws", () => {
    const results = API.flatMap((row) => row.examples.map((example) => [example.code, result(example)]));
    expect(results.filter(([, text]) => text === "" || text?.startsWith("throws"))).toEqual([]);
  });

  it("pins the facts of the table", () => {
    const of = (code: string) => {
      const example = API.flatMap((row) => row.examples).find((candidate) => candidate.code === code);
      if (example === undefined) throw new Error(`No example: ${code}`);
      return result(example);
    };
    expect(of('parseLogLevel("warn")')).toBe("1");
    expect(of('app.child("db").child("pool"), then info, then entry.context')).toBe("app:db:pool");
    expect(of("app.setLevel(LogLevel.TRACE), then child.getLevel()")).toBe("INFO");
    expect(of("app.addTransport(late), then child.info(...), then late.entries.length")).toBe("0");
    expect(of('removeTransport("memory") twice')).toBe("true, false");
    expect(of("close(), then info, then memory.entries.length")).toBe("1");
    expect(of("createLogger({ transports: [broken, memory], onTransportError })")).toBe("broken: Disk full, memory has 1");
    // A transport from `addTransport` keeps its own formatter. The site shows this fact of the package 1.0.0.
    expect(of("createLogger({ formatter: json }), then addTransport(callback), then info")).toBe("[INFO] Hello");
  });
});
