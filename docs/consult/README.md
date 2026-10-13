# Consulting an outside model

How to get a second opinion on a hard decision without turning a chat into the
project's memory.

## Why this exists

A conversation is not a durable artefact. When a decision is made only in chat,
the reasoning is lost, the next reader repeats the argument, and the answer cannot
be verified later. Everything that matters therefore lands in this repository: the
question, the answer, and the decision.

## The protocol

1. **Write the packet.** Copy [TEMPLATE.md](TEMPLATE.md) to
   `docs/consult/Q-NNNN-short-title.md` and fill in every section, including the
   options already considered and what a good answer looks like. The packet must
   be self-contained: the outside model sees this file and the repository, not the
   conversation that produced it.
2. **Record the block.** If the question blocks work, say which roadmap item or
   task it blocks and keep the packet's status `open`.
3. **Ask.** Give the outside model the file. Two supported ways:
   - It reads the repository itself (a read-only code connection or a fetch of
     the file URL). This is preferred: it can follow the linked sources.
   - Paste the file contents into the conversation. Then the answer can only be as
     good as the packet.
4. **Paste the answer verbatim** under `## Answer` in the same file, attributed
   with the model name and date. Do not summarize it on the way in.
5. **Interpret separately.** Write your own reading under `## Our reading`. An
   outside answer is a proposal, never an authority, and never overrides
   [AGENTS.md](../../AGENTS.md) or the validator.
6. **Decide and record.** If the decision is architectural, write the ADR in
   [docs/decisions/](../decisions/README.md) and link it from both the packet and
   [docs/ROADMAP.md](../ROADMAP.md). Set the packet status to `decided`.
7. **Commit the packet with the decision.** The packet is evidence of how the
   decision was reached.

## Rules

- **One question per packet.** Several questions in one file produce one
  unfocused answer.
- **A packet is not a task.** It resolves a decision; the task is written
  afterwards, from [tasks/TEMPLATE.md](../../tasks/TEMPLATE.md).
- **No secrets.** No API keys, tokens, passwords, or personal data in a packet.
  They are committed to a Git history that cannot be unpublished. Refer to
  credentials by name only (see
  [ADR-0007](../decisions/ADR-0007-credential-encryption.md)).
- **Ask rarely.** A packet is worth writing when the decision is expensive to
  reverse or genuinely contested. Routine choices are made locally and recorded in
  the task record.
- **A read-only outside model cannot commit.** It cannot write to this
  repository, so the operator or an implementing agent commits both the packet and
  the answer.

## Costs

Each packet should name the kind of answer it needs and the smallest one that
would be useful: a decision, a risk list, or a design sketch. This keeps an
expensive model on the part of the problem that actually needs it.
