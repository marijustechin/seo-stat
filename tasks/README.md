# Tasks

## Lifecycle

States: `proposed` -> `in-progress` -> `completed`. A task may be `cancelled`
instead of completed.

1. Propose: create a task from `TEMPLATE.md` with the next free ID and state
   `proposed`.
2. Start: set state to `in-progress` and update the implementation/verification
   states as work proceeds.
3. Complete: fill in all required sections, run the harness validation, and set
   state to `completed`.
4. Reconcile: make the State section and `tasks/INDEX.md` match reality.

## IDs and file names

- IDs are `TASK-NNNN`, allocated in order, never reused.
- File name: `tasks/TASK-NNNN-short-title.md`.

## Required record contents

Every task record contains: ID, title, state, owner, dates, and the sections
Objective, Scope, Acceptance criteria, Verification evidence, Completion notes,
and State. For completed tasks the harness validator enforces these sections and
the four State fields (Implementation, Verification, Commit, Deployment).

Commit and deployment are tracked separately from implementation and
verification. Never mark work committed or deployed unless it actually is.

## Index

`tasks/INDEX.md` lists all tasks and their current state.
