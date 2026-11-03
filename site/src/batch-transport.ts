/**
 * A transport with `flush` and `close`. The built-in transports do not have these two methods, so this site adds one. It
 * uses only the public `Transport` interface. A real transport sends each batch to a service in place of the wait.
 */
import type { Formatter, LogEntry, Transport } from "@mark1russell7/logger";

/** The lines that one flush sent, and the time of the send. */
export interface SentBatch {
  readonly lines: readonly string[];
  readonly at: Date;
}

export class BatchTransport implements Transport {
  readonly name = "batch";
  /** The lines that wait for the next flush. */
  readonly pending: string[] = [];
  /** The batches that a flush sent. */
  readonly sent: SentBatch[] = [];
  private readonly formatter: Formatter;
  private readonly sendMs: number;
  private closed = false;

  constructor(formatter: Formatter, sendMs: number) {
    this.formatter = formatter;
    this.sendMs = sendMs;
  }

  /** This property tells if `close` has started. */
  get isClosed(): boolean {
    return this.closed;
  }

  /** This method keeps the formatted line until the next flush. After `close`, it throws an `Error`. */
  write(entry: LogEntry): void {
    if (this.closed) throw new Error("The batch transport is closed.");
    this.pending.push(this.formatter.format(entry));
  }

  /** This method sends the pending lines as one batch. The promise resolves after the send. */
  async flush(): Promise<void> {
    const lines = this.pending.splice(0);
    if (lines.length === 0) return;
    await new Promise((done) => setTimeout(done, this.sendMs));
    this.sent.push({ lines, at: new Date() });
  }

  /** This method refuses new lines, and it sends the pending lines. */
  async close(): Promise<void> {
    this.closed = true;
    await this.flush();
  }
}
