---
paths:
  - "apps/web/**"
---

# Web UI (Next.js)

Why the web looks like this: ADR-025 in [docs/decisions.md](../../docs/decisions.md). The Next.js docs of the
installed version live in `node_modules/next/dist/docs` — read them before writing an API from memory: Next 16 renamed
`middleware` to `proxy`, generates `PageProps` / `LayoutProps` types (`next typegen`) and has root params.

## The browser talks only to Next

- [ ] Data comes from the NestJS API only through `src/server/a-p-i-client.ts` — a server-only module; a client
      component never calls `fetch` to the API and never knows its address
- [ ] Every answer of the API is validated with a Zod schema in the client before use; a failure is an
      `APIClientError` with a code (`APIErrorCodeEnum`), never a raw `fetch` error
- [ ] A function that reads the API starts with `await connection()` — a catch around the request would otherwise
      swallow the signal that the page is dynamic, and the build would prerender it
- [ ] `process.env` is read only in `src/server/env.ts` (Zod, defaults); a new `WEB_*` key goes into `.env.example`.
      No `NEXT_PUBLIC_*` variable — nothing of the configuration reaches the browser

## Server and client components

- [ ] A component is a server component by default; `'use client'` only where there is state, an event handler or a
      browser hook — and as deep in the tree as possible
- [ ] A server component never passes a function to a client component (`component={Link}` of Mantine included) —
      wrap it in a small client component (`ButtonLink`)
- [ ] Slow data streams in through `<Suspense>` with a fallback; the frame never waits for the API
- [ ] A redirect that must answer 3xx lives in `redirects()` of `next.config.ts` — a redirect or `notFound()` after
      streaming has started answers 200

## Language and addresses

- [ ] The language is the first segment of every address (`/en/…`, `/uk/…`, next-intl, `localePrefix: 'always'`);
      a link goes through `Link` / `getPathname` of `src/i18n/navigation.ts`, never a bare `next/link` with a
      hand-written prefix
- [ ] Every visible text is a key in both `messages/en.json` and `messages/uk.json` — never a literal in a component;
      the keys are typed through `AppConfig` (`src/global.ts`)
- [ ] Filters and the page state that a link should keep live in the query string, never only in component state
- [ ] Every page exports `generateMetadata` with its own title; the layout adds the application name by the template

## Files and names

- [ ] File names are kebab-case with the acronym rule of [code-style.md](code-style.md) (`a-p-i-status.tsx`);
      a component is PascalCase, its props are a non-exported `I…Props` interface in the same file with `Readonly`
      properties
- [ ] Routes are folders of `src/app/[locale]/`; `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`,
      `not-found.tsx` keep the names Next expects
- [ ] Imports use the `@/` alias for `src/`; relative imports carry no extension — the web resolves modules as a
      bundler, not as `nodenext`
- [ ] JSDoc on every component, hook and exported function, as in [code-style.md](code-style.md)

## UI

- [ ] Mantine components and its theme (`src/theme.ts`) first; no second UI kit, no CSS framework
- [ ] Icons only from `@tabler/icons-react`
- [ ] The colour scheme is Mantine's (`auto` by default, `ColorSchemeScript` in the layout) — never a hand-made toggle
      of a class
