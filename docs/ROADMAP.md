# Roadmap

This file is the plan of the logger. The Status page of the site reads it.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| L1 | Package 1.0.0 | done | The logger has levels, child contexts, three formatters and three transports. |
| L2 | Project site | done | The site runs the real package in the browser and shows the path of each record. |
| L3 | Formatter on `addTransport` | not started | A transport from `addTransport` keeps its own formatter. The owner decides if the logger gives it the formatter of the logger. |
| L4 | Transport with `flush` and `close` | not started | The built-in transports do not have these two methods. The site has a batch transport as an example. |
