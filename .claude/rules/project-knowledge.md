# Project Knowledge: Behavior Rules & Lessons Learned

---

## Behavior Rules

### Confirmation is required before changing the project

Never create, edit, delete, or move a file in the repository working tree, and never run a command that rewrites it or git history (`git commit` / `push` / `branch` / `restore` / `checkout` / `reset` / `stash`, `pnpm version`, package installs, `docker compose down -v`), without explicit confirmation.

**Only these exact phrases count:** `"do it"`, `"go ahead"`, `"you can do it"`. Approving a plan with the ExitPlanMode button counts as well.

**NOT sufficient:** "yes", "okay", "aga", "execute please", "execute", agreement-sounding words, or any paraphrase. No exceptions, no interpretation.

**Exempt — no confirmation needed:**

- Any file or folder under `.claude/plans/` — writing and revising a plan is how it reaches the user for approval; closing and moving it follow the plans folder layout in [workflow.md](workflow.md)
- Auto-memory files in `docs/memory/`
- Temporary files in the session scratchpad, outside the repository
- Lint/format auto-fix scripts (`pnpm lint:fix`, `pnpm prettier:fix`) — they only reformat, never change behavior

**Scope of one confirmation:** it covers the proposed changes and updating the plan's `Status` / `Implemented` lines. Anything beyond the proposal needs a new confirmation.

**Why:** a misread agreement word followed by a destructive command (`git restore`, `git reset`) loses uncommitted work that cannot be recovered.

When in doubt, ask explicitly: "Reply _do it_ to apply these changes."

---

### Always use braces for block operators — and blank lines around them

All `if`, `else`, `for`, `while`, `for...of`, `for...in` use `{}` even for single-line bodies, and have a blank line before and after the block. Details: [feedback-block-operators-blank-lines.md](../../docs/memory/feedback-block-operators-blank-lines.md).

```typescript
// ❌ Wrong
if (condition) return null;

// ✅ Correct
const vacancy = await this.vacancyRepository.findByURL(url);

if (vacancy) {
  return null;
}

return this.extract(url);
```

**Why:** consistency and readability — braceless single-liners are prone to bugs when a second statement is added.

---

### Promise.allSettled for bulk operations

Use `Promise.allSettled` (not `Promise.all`) when N independent operations must all be attempted — fetching several vacancies, cleaning several screenshots.

- Attempt all of them
- `warn`-log each rejected result
- Return only the fulfilled values

**Why:** `Promise.all` fails fast on the first rejection and leaves the rest unprocessed. The expected behavior for bulk ops is "attempt everything, report what failed."

---

### NestJS unit testing patterns

**Unbound-method fix:** never pass a method directly to `expect()` from a typed object — use `vi.spyOn()`:

```typescript
// ❌ triggers @typescript-eslint/unbound-method
expect(bot.sendMessage).toHaveBeenCalled();

// ✅ capture the spy BEFORE calling the method under test
const sendSpy = vi.spyOn(bot, 'sendMessage');
await service.sendDigest(vacancies);
expect(sendSpy).toHaveBeenCalled();
```

**ConfigService mocking:** use `mockImplementation` with a key switch, not `mockReturnValue` — otherwise all keys return the same value and env-gated branches stay uncovered:

```typescript
vi.spyOn(configService, 'get').mockImplementation((key: string) => {
  if (key === 'OLLAMA_URL') {
    return 'http://localhost:11434';
  }

  return undefined;
});
```

---

## Project Lessons

> Add a lesson here when a mistake cost real time. Each lesson: what failed, the symptom, the cause, a checklist.

### A green build proves nothing about bootstrap

`tsc` checks types; a provider missing from a module's `exports`, a constant read inside a decorator
argument before it is initialised, or a missing env key all compile cleanly and kill the app at start-up.

- [ ] Verify a change by starting the app and seeing it work (a job processed, a digest sent), never by a green build
- [ ] Never evaluate an imported constant inside a decorator argument — inline the literal or move the work into a method body
- [ ] A BullMQ worker is verified by a processed job in Bull Board, not by the absence of errors
