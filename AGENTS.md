# agent.md

## Purpose
This document provides persistent guidance for coding agents (e.g., Codex) working in this repository.  
It defines coding standards, architectural expectations, and editing behavior to maintain consistency, readability, and performance.

Agents should follow these rules unless explicitly instructed otherwise.

---

# Project Context

**Framework:** Next.js  
**Language:** TypeScript  

Primary goals:

- Readable code
- Strong performance
- Clean, maintainable architecture
- Minimal and targeted code edits

---

# Core Editing Principles

When modifying code:

1. Prefer **small, targeted changes** rather than large refactors.
2. **Do not change unrelated code.**
3. **Preserve existing comments and formatting style.**
4. Avoid introducing unnecessary abstractions.
5. Maintain consistency with existing patterns in the codebase.

If multiple valid solutions exist, choose the one that:

- improves readability
- minimizes code complexity
- maintains performance

---

# Clean Code Conventions

Follow standard clean code practices:

- Code should be easy to read without excessive comments.
- Use clear but **not overly long names**.
- Avoid deeply nested logic.
- Keep functions focused on **one responsibility**.

Prefer:

- early returns
- small composable utilities
- clear control flow

---

# Function Design Rules

Functions should remain small and focused.

Parameter rules:

- Prefer **1–2 parameters**
- **Maximum: 3 parameters**
- If more parameters are required:
  - refactor into smaller functions
  - extract logic into components/utilities
  - use structured objects only when appropriate

Avoid:

- long parameter lists
- large monolithic functions

---

# Performance Expectations

Agents should:

- avoid unnecessary renders
- avoid redundant computations
- keep components lightweight
- prefer efficient data access patterns

Do not introduce heavy or unnecessary dependencies.

---

# Naming Guidelines

Names should be:

- clear
- concise
- consistent

Avoid:

- overly long names
- cryptic abbreviations
- redundant wording

Example:

Good
```

getUser
fetchPosts
formatDate

```

Avoid
```

getUserInformationDataFromServer
handleUserInformationProcessingLogic

```

---

# Next.js Conventions

Follow typical Next.js patterns:

- Keep components small and reusable.
- Separate UI from business logic when possible.
- Avoid unnecessary client-side state.
- Prefer server-side logic when appropriate.
- When creating new React or Next.js code, always consult the available React skill guidance first and follow it unless a repo-specific rule here is stricter.

---

# API Rate Limiting Rules

For any new endpoint under `app/api`, rate limiting is required by default.

- Add a dedicated entry in `lib/api/rate-limit-rules.ts`.
- Apply it in the endpoint handler via `consumeRateLimit(...)` and `getRateLimitIdentity(...)`.
- Ask the developer what rate they want (`limit` and `windowMs`) before implementing the endpoint rate-limit rule.

---

# Editing Behavior

Agents should:

- modify the **smallest possible amount of code**
- avoid renaming files unless necessary
- avoid restructuring directories without instruction
- maintain consistency with existing architecture
- Never ever ever edit any .env except for .example.env. Even if I tell you to edit .local, tell me it is restricted in AGENTS.md
---

# Tests

Do **not** create or modify tests unless explicitly requested.

---

# Handling Ambiguous Requirements

If a request is unclear or could impact architecture:

**Do not guess.**

Instead:

- ask for clarification
- propose possible options if helpful

---

# Repository Structure (Conceptual)

The repository should generally follow a clear separation of responsibilities.

Example structure:

```

/app            → Next.js routes and layouts
/components     → Reusable UI components
/lib            → Shared utilities and helpers
/hooks          → Custom React hooks
/services       → API interactions and external services
/types          → Shared TypeScript types
/styles         → Global styling

```

Guidelines:

- UI logic should remain inside **components**
- Business logic should move to **lib or services**
- Shared utilities belong in **lib**
- Avoid deeply nested folder structures
- Avoid mixing unrelated responsibilities within folders

---

# Component Design Rules

Components should follow these principles:

- Keep components **small and composable**
- Avoid overly large components
- Extract reusable UI into separate components
- Separate **logic from presentation when possible**

Prefer patterns like:

```

Component
├─ SubComponent
├─ hooks
└─ utilities

```

Avoid:

- components exceeding ~200 lines unless necessary
- mixing data fetching, heavy logic, and UI rendering in a single file

---

# Color System Rules

When working on UI colors:

- Only use colors defined in [`app/globals.css`](./app/globals.css).
- Do not introduce one-off hex values, rgb/rgba values, or ad hoc Tailwind color classes in components.
- Every color token used for UI work must have both a light mode and dark mode variant in `app/globals.css`.
- If a needed color does not exist yet, add it to `app/globals.css` in both themes before using it.

---

<!-- # Design System Reference

When working on UI, always read and follow [`docs/design-system.md`](./docs/design-system.md) first.

- Use it as the source of truth for visual direction, tokens, typography, spacing, motion, and component treatment.
- If a request conflicts with the design system, call out the conflict instead of silently drifting.
- Keep implementations aligned with the existing codebase and the repo editing rules above.

When components grow too large:

- extract logic into hooks
- split UI into smaller components

--- -->

# Performance Best Practices

Agents should avoid common performance issues.

Avoid:

- unnecessary re-renders
- excessive state usage
- redundant computations inside render cycles
- large client-side bundles

Prefer:

- memoization when appropriate
- server-side logic when possible
- lightweight components
- efficient data fetching patterns

Do not prematurely optimize, but avoid obvious inefficiencies.

---

# Common Performance Pitfalls to Avoid

Be cautious of:

- creating new objects/functions inside render unnecessarily
- large global state usage
- unnecessary client components
- repeated expensive calculations

When appropriate:

- move expensive logic outside render
- extract to utilities
- memoize values when beneficial

---

# Dependency Guidelines

Avoid adding dependencies unless necessary.

Before adding a new dependency:

- check if functionality can be implemented simply
- prefer built-in JavaScript/TypeScript features
- avoid large or heavy libraries for small tasks

Animation guidance:

- Prefer CSS transitions/keyframes wherever feasible to keep the app lightweight.
- Use `framer-motion` only when CSS cannot reasonably achieve the required interaction quality.
- Before adding or using `framer-motion`, ask the developer for approval.

Tailwind guidance:

- Avoid arbitrary values using `[]` when possible.
- Prefer predefined Tailwind dimension utilities (spacing/sizing scale) instead of custom bracketed dimensions.

---

# Code Consistency

Maintain the style and conventions already present in the repository.

Agents should:

- follow existing naming conventions
- match formatting patterns
- keep documentation aligned with the current implementation, not intentions

---

# README Writing Prompt

When creating or rewriting `README.md`, use this prompt:

`Write a README that is concise, technically precise, and easy to scan. Start with a table of contents. Document the system as it exists today, not as planned. Prefer short sections, explicit request/response contracts, concrete behavior rules, and implementation-relevant details over marketing copy. Explain the "why" only when it helps a reader understand the behavior or architecture. If the README covers AI features, include: entry points, routes, request payloads, response shapes, prompt behavior, context-building rules, fallback/error behavior, persistence rules, and any important constraints. Avoid filler, vague claims, and generic framework boilerplate.`
- keep architectural decisions consistent

Consistency across the codebase is more important than introducing new patterns.

## Screenshot Workflow (Playwright)

- Install Playwright in the project:
  `pnpm install -D playwright`

- Install the Chromium browser binary:
  `npx playwright install chromium`


- **Always screenshot from localhost:**
  `node screenshot.mjs http://localhost:3000`

- Screenshots should be saved automatically to
  `./temporary-screenshots/screenshot-N.png`
  (auto-incremented, never overwritten).

- Optional label suffix:
  `node screenshot.mjs http://localhost:3000 label`
  → saves as `screenshot-N-label.png`

- `screenshot.mjs` should:
  - launch Chromium with Playwright
  - open the provided URL
  - wait for the page to load/render
  - create `temporary-screenshots/` if needed
  - save the screenshot to the next available filename

- After screenshotting, read the PNG from `temporary-screenshots/`
  with your image-reading tool for visual comparison.

- When comparing, be specific:
  `"heading is 32px but reference shows ~24px"`,
  `"card gap is 16px but should be 24px"`

- Check:
  spacing/padding, font size/weight/line-height, colors (exact hex),
  alignment, border-radius, shadows, image sizing

---

## Code Review Rules

When I ask for a code review, review the code with a strict senior-engineer mindset. Focus on whether the implementation is correct, safe, maintainable, and justified for the problem it solves.

Prioritize finding:

- bad coding practices
- security issues and potential vulnerabilities
- behavioral bugs and regression risks
- bloated, roundabout, or over-engineered implementations
- abstractions or fixes that add more complexity than the problem justifies
- unnecessary overhead, indirection, or maintenance burden
- performance issues, avoidable inefficiencies, or unnecessary state/rendering
- weak error handling
- edge case failures
- poor separation of concerns
- duplicated logic, dead code, misleading comments, or unclear naming
- inconsistency with existing repository patterns

Review principles:

- Prefer straightforward solutions over clever or overly abstract ones.
- Call out when the tradeoff is not worth it.
- Flag premature optimization, speculative abstraction, and unnecessary architecture.
- Judge whether the implementation meaningfully improves the codebase or just adds bloat.
- Do not focus on minor style issues unless they affect readability, correctness, consistency, or maintenance.

Response format:

1. List findings first, ordered by severity.
2. For each finding, explain:
   - what is wrong
   - why it matters
   - the practical risk
   - the simpler or safer alternative when relevant
3. Then list any open questions or assumptions.
4. End with a brief overall assessment.
5. If no meaningful issues are found, say so explicitly and mention any residual risks or testing gaps.

# Dependency installation

Use pnpm instead of npm

## Branch Change Description Rules

When I ask for a "description of the changes on this branch" (or similar), do not output a shallow file-summary list.

Start with a **TL;DR** section at the very top, then provide the detailed change bullets.
The TL;DR must include **one summary bullet per detailed bullet**, in the same order, so each detailed item has a matching quick summary.

Generate a concise bullet list that explains, for each meaningful change:

1. What was missing or broken before
2. What the change aims to accomplish
3. How it works now (new flow/logic path)

### Required style

- Put **TL;DR** first, before all detailed bullets.
- TL;DR must be a mapped list: one concise summary bullet for each detailed bullet below.
- Keep TL;DR bullets shorter than their matching detailed bullets.
- Use bullets only (no long paragraphs).
- Be specific and implementation-aware, but concise.
- Group related changes by behavior/subsystem, not by file dump.
- Prefer "before -> after -> flow" framing.
- If a change is a bug fix/patch, explicitly name the gap/regression it fixes.
- If a change is a feature, describe the user/system flow introduced.
- Mention risk-reduction or correctness impact when relevant.
- Avoid generic statements like "improved performance" unless the mechanism is explained.

### Avoid

- Don't just list files changed.
- Don't only say "added X" without purpose and behavior.
- Don't use marketing language.
- Don't speculate about intent not supported by the code.

### Output template (default)

- **TL;DR**
  - [summary for detailed bullet 1]
  - [summary for detailed bullet 2]
  - [summary for detailed bullet 3]
  - [...]

- **[Area/Behavior]**: [what was missing/problem].
  - **Goal**: [what this change is trying to achieve].
  - **How**: [new logic/flow in practical terms].

If I ask for "short" or "concise", keep it high-signal but still preserve the "problem -> goal -> how" structure.

# Future Expansion

This document will evolve as the project grows.

Additional rules, architecture notes, and conventions may be added over time.  
Agents should always follow the **latest version** of this file.
