"use client";

import Link from "next/link";
import { ActionInlineBinding } from "@/components/settings/keybinding-display";
import { ACTION_IDS } from "@/lib/keybindings";

type InlineKeybindingProps = {
  actionId: (typeof ACTION_IDS)[keyof typeof ACTION_IDS];
  maxCombos?: number;
};

export function InlineKeybinding({ actionId, maxCombos = 1 }: InlineKeybindingProps) {
  return <ActionInlineBinding actionId={actionId} maxCombos={maxCombos} className="underline decoration-dashed underline-offset-3 text-[#f8c94a]" separatorClassName="mx-1 text-white/40" />;
}

export function HomeInlineHelp() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/75 md:text-base">
      <span>Navigate with</span>
      <InlineKeybinding actionId={ACTION_IDS.MOVE_LEFT} />
      <InlineKeybinding actionId={ACTION_IDS.MOVE_DOWN} />
      <InlineKeybinding actionId={ACTION_IDS.MOVE_UP} />
      <InlineKeybinding actionId={ACTION_IDS.MOVE_RIGHT} />
      <span>, open with</span>
      <InlineKeybinding actionId={ACTION_IDS.OPEN_SHEET} />
      <span>, search with</span>
      <InlineKeybinding actionId={ACTION_IDS.FOCUS_SEARCH} />
      <span>, clear with</span>
      <InlineKeybinding actionId={ACTION_IDS.CLEAR_SEARCH} />
      <span>, help with</span>
      <InlineKeybinding actionId={ACTION_IDS.TOGGLE_HELP} />
      <span>.</span>
    </p>
  );
}

export function SheetInlineHelp() {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs text-white/75">
      <Link href="/" className="transition hover:text-white">{"<- Back to grid"}</Link>
      <span>with</span>
      <InlineKeybinding actionId={ACTION_IDS.BACK_TO_HOME} maxCombos={2} />
      <span>, navigate with</span>
      <InlineKeybinding actionId={ACTION_IDS.MOVE_LEFT} />
      <InlineKeybinding actionId={ACTION_IDS.MOVE_DOWN} />
      <InlineKeybinding actionId={ACTION_IDS.MOVE_UP} />
      <InlineKeybinding actionId={ACTION_IDS.MOVE_RIGHT} />
      <span>, copy with</span>
      <InlineKeybinding actionId={ACTION_IDS.COPY_COMMAND} />
      <span>, details with</span>
      <InlineKeybinding actionId={ACTION_IDS.SHOW_EXAMPLE} />
      <span>.</span>
    </p>
  );
}
