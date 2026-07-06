import tseslint from 'typescript-eslint';

/**
 * DS-I1 governance — Design System invariant enforcement (DESIGN-SYSTEM.md §5).
 *
 * Standalone ESLint flat config. It is deliberately NOT named `eslint.config.*`,
 * so ESLint never auto-discovers it: the project's base lint (`pnpm lint`,
 * `next build`, the IDE) is unaffected. It is invoked explicitly by lint-staged,
 * on staged files only, so governance acts on the diff and never as a big-bang:
 *
 *   eslint --no-config-lookup --no-warn-ignored --config eslint.design-tokens.mjs <staged files>
 *
 * Scope: apps/web/src TS/TSX only. `components/landing/**` is exempt (F5, DS §5).
 * The pre-existing violations are NOT touched here; they migrate per module in F2.
 * Legitimate exceptions are declared inline (DS §5):
 *   // eslint-disable-next-line no-restricted-syntax -- <reason> (<debt id>)
 */

// Pattern sources — verbatim from DESIGN-SYSTEM.md §5.
const RAW_SCALES = String.raw`\b(?:bg|text|border|ring|fill|stroke|divide|from|to|via|shadow|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b`;
const RAW_BLACK_WHITE = String.raw`\b(?:bg|text|border)-(?:white|black)(?:\/\d+)?\b`;
const RAW_ACCENT = String.raw`\b(?:ring|border|bg|text)-accent\b`;
const RAW_ARB_TEXT = String.raw`\btext-\[[^\]]+\]`;
// Exception (DS-I1 §5, Patrón 4): the shadow/z infrastructure tokens live in :root
// (not @theme), so they are consumed via arbitrary-value references to the CSS
// variable — shadow-[--shadow-card], z-[--z-shell], and the [var(--…)] form. The
// negative lookahead `(?!--|var\(--)` allows those token references while still
// forbidding hardcoded values. text-[…] intentionally keeps no exception: typography
// is consumed by role (text-2xs, §3.4), never via text-[--…].
const RAW_ARB_SHADOW = String.raw`\bshadow-\[(?!--|var\(--)[^\]]+\]`;
const RAW_ARB_Z = String.raw`\bz-\[(?!--|var\(--)[^\]]+\]`;

// Messages point to the substitute token (DS §4.1 map).
const MSG = {
  scales:
    'DS-I1: usa un token del sistema (bg-surface, text-foreground, text-muted-foreground, border-border/border-border-soft) o la taxonomía de estado (StatusBadge, DS §7) en lugar de una escala cruda de Tailwind.',
  blackWhite:
    'DS-I1: usa bg-surface / text-foreground en lugar de bg-white / bg-black / text-white.',
  accent:
    "DS-I1 (D-01): no existe el token 'accent'; el acento corporativo es --primary. Usa el contrato de foco del sistema (ring-ring).",
  arbText:
    'DS-I1 (§3.4): usa un rol tipográfico (p. ej. text-2xs) en lugar de un tamaño arbitrario text-[...].',
  arbShadow:
    'DS-I1 (§3.5): usa un token de sombra del sistema en lugar de shadow-[...] arbitrario.',
  arbZ: 'DS-I1 (§3.5): usa un token de z-index del sistema en lugar de z-[...] arbitrario.',
};

// Each pattern is enforced on both string literals and template-literal chunks.
function forbid(raw, message) {
  return [
    { selector: `Literal[value=/${raw}/]`, message },
    { selector: `TemplateElement[value.raw=/${raw}/]`, message },
  ];
}

export default [
  { ignores: ['apps/web/src/components/landing/**'] },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        ...forbid(RAW_SCALES, MSG.scales),
        ...forbid(RAW_BLACK_WHITE, MSG.blackWhite),
        ...forbid(RAW_ACCENT, MSG.accent),
        ...forbid(RAW_ARB_TEXT, MSG.arbText),
        ...forbid(RAW_ARB_SHADOW, MSG.arbShadow),
        ...forbid(RAW_ARB_Z, MSG.arbZ),
      ],
    },
  },
];
