"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { useKeyboardContext } from "@/hooks/use-keyboard-context";
import { ACTION_IDS, type ActionId } from "@/lib/keybindings";
import type { KeyboardScopeId } from "@/lib/keyboard-scope";
import { InlineKeybinding } from "./inline-keybinding-help";

/**
 * Surface identifies the page that hosts the inline help.
 *
 * A surface is the *static* identity of the page (known at render time
 * from the component tree), as opposed to the *dynamic* scope (driven
 * by the user's interactions). Two surfaces can share the same active
 * scope (notably `global`) but want different inline help, so we need
 * both axes to resolve the right entry.
 */
type InlineHelpSurface = "home" | "sheet";

type InlineHelpToken =
  | { kind: "text"; text: string }
  | { kind: "key"; actionId: ActionId; maxCombos?: number }
  | { kind: "link"; href: string; label: string };

type InlineHelpEntry = {
  /** Tokens rendered left-to-right, separated by a thin space. */
  tokens: InlineHelpToken[];
};

/**
 * Map of (surface, scope) -> inline help entry. Looked up by:
 *   1. `SCOPE_HELP_MAP[surface][activeScope]`
 *   2. fallback `SCOPE_HELP_MAP[surface].default` (which targets the
 *      surface's root scope: `home` on the home page, `sheet` on a
 *      cheatsheet page)
 *
 * Modal scopes that fully mask the page (`settings`, `help`,
 * `layout`) are intentionally absent: their own overlay UI carries
 * the relevant hints, so falling back to `default` is fine. The
 * `info` modal on the home page is small enough that the inline
 * help line remains visible behind it, so we provide a dedicated
 * entry that advertises the close binding.
 */
const SCOPE_HELP_MAP: Record<InlineHelpSurface, Partial<Record<KeyboardScopeId | "default", InlineHelpEntry>>> = {
  home: {
    // Active scope `home` on the home page = the default surface help.
    default: {
      tokens: [
        { kind: "text", text: "Navigate with" },
        { kind: "key", actionId: ACTION_IDS.HOME_MOVE_LEFT },
        { kind: "key", actionId: ACTION_IDS.HOME_MOVE_DOWN },
        { kind: "key", actionId: ACTION_IDS.HOME_MOVE_UP },
        { kind: "key", actionId: ACTION_IDS.HOME_MOVE_RIGHT },
        { kind: "text", text: ", open with" },
        { kind: "key", actionId: ACTION_IDS.OPEN_SHEET },
        { kind: "text", text: ", search with" },
        { kind: "key", actionId: ACTION_IDS.FOCUS_SEARCH },
        { kind: "text", text: ", clear with" },
        { kind: "key", actionId: ACTION_IDS.CLEAR_SEARCH },
        { kind: "text", text: ", info with" },
        { kind: "key", actionId: ACTION_IDS.SHOW_INFO },
        { kind: "text", text: ", help with" },
        { kind: "key", actionId: ACTION_IDS.TOGGLE_HELP },
        { kind: "text", text: "." },
      ],
    },
    info: {
      tokens: [
        { kind: "text", text: "Info modal: close with" },
        { kind: "key", actionId: ACTION_IDS.INFO_CLOSE, maxCombos: 2 },
        { kind: "text", text: "." },
      ],
    },
  },
  sheet: {
    default: {
      tokens: [
        { kind: "link", href: "/", label: "<- Back to grid" },
        { kind: "text", text: "with" },
        { kind: "key", actionId: ACTION_IDS.BACK_TO_HOME, maxCombos: 2 },
        { kind: "text", text: ", navigate with" },
        { kind: "key", actionId: ACTION_IDS.SHEET_MOVE_LEFT },
        { kind: "key", actionId: ACTION_IDS.SHEET_MOVE_DOWN },
        { kind: "key", actionId: ACTION_IDS.SHEET_MOVE_UP },
        { kind: "key", actionId: ACTION_IDS.SHEET_MOVE_RIGHT },
        { kind: "text", text: ", copy with" },
        { kind: "key", actionId: ACTION_IDS.COPY_COMMAND },
        { kind: "text", text: ", details with" },
        { kind: "key", actionId: ACTION_IDS.SHOW_EXAMPLE },
        { kind: "text", text: "." },
      ],
    },
    "layout-navigation": {
      tokens: [
        { kind: "text", text: "Layout: focus with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_NAV_LEFT },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_NAV_DOWN },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_NAV_UP },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_NAV_RIGHT },
        { kind: "text", text: ", move with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_GOTO_MOVE },
        { kind: "text", text: ", resize with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_GOTO_RESIZE },
        { kind: "text", text: ", reset with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_RESET },
        { kind: "text", text: "." },
      ],
    },
    "layout-move": {
      tokens: [
        { kind: "text", text: "Move with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_MOVE_LEFT },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_MOVE_DOWN },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_MOVE_UP },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_MOVE_RIGHT },
        { kind: "text", text: ", strict with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT },
        { kind: "text", text: ", back to nav with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_GOTO_NAVIGATION },
        { kind: "text", text: ", resize with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_GOTO_RESIZE },
        { kind: "text", text: "." },
      ],
    },
    "layout-resize": {
      tokens: [
        { kind: "text", text: "Grow with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_RESIZE_GROW_UP },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT },
        { kind: "text", text: ", shrink with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT },
        { kind: "text", text: ", back to nav with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_GOTO_NAVIGATION },
        { kind: "text", text: ", move with" },
        { kind: "key", actionId: ACTION_IDS.LAYOUT_GOTO_MOVE },
        { kind: "text", text: "." },
      ],
    },
    dev: {
      tokens: [
        { kind: "text", text: "Dev mode: save with" },
        { kind: "key", actionId: ACTION_IDS.DEV_SAVE_LAYOUT },
        { kind: "text", text: ", reset with" },
        { kind: "key", actionId: ACTION_IDS.DEV_RESET_LAYOUT },
        { kind: "text", text: ", logs with" },
        { kind: "key", actionId: ACTION_IDS.DEV_TOGGLE_LOGS },
        { kind: "text", text: ", axes with" },
        { kind: "key", actionId: ACTION_IDS.DEV_ENTER_AXES_MODE },
        { kind: "text", text: ", exit with" },
        { kind: "key", actionId: ACTION_IDS.TOGGLE_DEVELOPER_MODE },
        { kind: "text", text: "." },
      ],
    },
    "dev-logs": {
      tokens: [
        { kind: "text", text: "Logs: navigate with" },
        { kind: "key", actionId: ACTION_IDS.DEV_LOGS_CURSOR_DOWN },
        { kind: "key", actionId: ACTION_IDS.DEV_LOGS_CURSOR_UP },
        { kind: "text", text: ", copy filename with" },
        { kind: "key", actionId: ACTION_IDS.DEV_LOGS_COPY_FILENAME },
        { kind: "text", text: ", delete with" },
        { kind: "key", actionId: ACTION_IDS.DEV_LOGS_DELETE },
        { kind: "text", text: ", close with" },
        { kind: "key", actionId: ACTION_IDS.DEV_LOGS_CLOSE },
        { kind: "text", text: "." },
      ],
    },
    "dev-axes": {
      tokens: [
        { kind: "text", text: "Axes: move with" },
        { kind: "key", actionId: ACTION_IDS.DEV_AXES_CURSOR_LEFT },
        { kind: "key", actionId: ACTION_IDS.DEV_AXES_CURSOR_DOWN },
        { kind: "key", actionId: ACTION_IDS.DEV_AXES_CURSOR_UP },
        { kind: "key", actionId: ACTION_IDS.DEV_AXES_CURSOR_RIGHT },
        { kind: "text", text: ", toggle col with" },
        { kind: "key", actionId: ACTION_IDS.DEV_AXES_TOGGLE_COL },
        { kind: "text", text: ", toggle row with" },
        { kind: "key", actionId: ACTION_IDS.DEV_AXES_TOGGLE_ROW },
        { kind: "text", text: ", exit with" },
        { kind: "key", actionId: ACTION_IDS.DEV_AXES_EXIT },
        { kind: "text", text: "." },
      ],
    },
  },
};

type ContextualInlineHelpProps = {
  surface: InlineHelpSurface;
  /**
   * Optional className appended to the outer `<p>`. When omitted the
   * component picks a sensible default matching the previous
   * Home/Sheet inline help styling.
   */
  className?: string;
};

/**
 * Renders an inline keybinding help line that adapts to the active
 * keyboard scope. The `surface` prop disambiguates pages that share
 * the same root scope (home and sheet both root at `global`).
 *
 * When the active scope has no entry in `SCOPE_HELP_MAP[surface]`,
 * the surface's `default` entry is used. This is the desired
 * behaviour for transient/modal scopes (`settings`, `help`, etc.)
 * which mask the inline help anyway.
 */
export function ContextualInlineHelp({ surface, className }: ContextualInlineHelpProps) {
  const { activeScope } = useKeyboardContext();
  const surfaceMap = SCOPE_HELP_MAP[surface];
  const entry = surfaceMap[activeScope] ?? surfaceMap.default;

  if (!entry) return null;

  const baseClass =
    surface === "home"
      ? "mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/75 md:text-base"
      : "flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs text-white/75";

  return (
    <p
      className={className ?? baseClass}
      data-testid="contextual-inline-help"
      data-surface={surface}
      data-scope={activeScope}
    >
      {entry.tokens.map((token, index) => (
        <Fragment key={index}>{renderToken(token)}</Fragment>
      ))}
    </p>
  );
}

function renderToken(token: InlineHelpToken): ReactNode {
  switch (token.kind) {
    case "text":
      return <span>{token.text}</span>;
    case "key":
      return <InlineKeybinding actionId={token.actionId} maxCombos={token.maxCombos} />;
    case "link":
      return (
        <Link href={token.href} className="transition hover:text-white">
          {token.label}
        </Link>
      );
  }
}
