---
project: drift-demo
spec_home: specs
repos: app=repos/app, lib=repos/lib
task_prefix.app: APP
task_prefix.lib: LIB
base_branch.app: main
base_branch.lib: qa
---
## Notes
The test creates repos/app and repos/lib at runtime. origin/main exists for app; origin/qa does not exist for lib.
