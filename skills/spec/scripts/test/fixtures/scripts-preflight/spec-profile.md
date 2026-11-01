---
project: preflight-demo
spec_home: specs
repos: good=repos/good, plain=repos/plain, gone=repos/gone
preflight: echo preflight-ok => preflight-ok; echo something else => not-there; true; false; echo DEMO_TOKEN=__TOKEN__ >&2 => never-printed; echo found __TOKEN__ here => never-printed; printf '%0300d' 0 => never-printed; env => never-printed
---
## Human-only actions
## Notes
