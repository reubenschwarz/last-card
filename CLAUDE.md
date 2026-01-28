Use 'bd' for task tracking.

## Finding work (avoiding conflicts with other agents)

```bash
# See tasks ready AND not already claimed
bd ready | grep -v "◐"

# Or check both lists:
bd ready                      # Shows all unblocked tasks
bd list --status=in_progress  # Shows tasks already being worked on
```

## Before starting ANY task

ALWAYS mark it as in_progress BEFORE writing code:
```bash
bd update <id> --status=in_progress
```

This prevents other agents from picking up the same task.
