---
spec: clean
ticket: none
tier: M
status: draft
refs: app@{{APP_SHA}}, lib@{{LIB_SHA}}
door: 2-way
---
# Clean

The handler lives in app:src/same.ts#Same.method and calls `app:src/lib.ts#doThing`.

| Component | Ref |
|---|---|
| other | app:src/other.ts#stable |
| constant | `app:src/lib.ts#keep`. |
| helper | lib:pkg/util.go#Helper |

Not references: https://example.com/page#anchor, notarepo:src/x.txt#foo, myapp:src/lib.ts#doThing.
<!-- Guidance, not a reference: app:src/commented.ts#hidden -->
