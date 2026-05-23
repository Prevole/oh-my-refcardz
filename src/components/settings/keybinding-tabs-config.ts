import type { KeybindingContext } from "@/lib/keybindings";
import type { KeybindingsSubTab, KeybindingsSubSubTab } from "@/hooks/use-ui-settings";

export type SubTabConfig = {
  id: KeybindingsSubTab;
  label: string;
  intro: string;
  contexts?: KeybindingContext[];
};

export type SubSubTabConfig = {
  id: KeybindingsSubSubTab;
  label: string;
  intro: string;
  contexts: KeybindingContext[];
};

export const SUB_TABS: SubTabConfig[] = [
  {
    id: "general",
    label: "General",
    intro: "Shortcuts active everywhere, regardless of the current page. Help and settings navigation bindings are scoped to their respective modals but are grouped here for discoverability.",
    contexts: ["global", "help", "settings"],
  },
  {
    id: "home",
    label: "Home",
    intro: "Shortcuts active on the home grid.",
    contexts: ["home"],
  },
  {
    id: "cheatsheet",
    label: "Cheatsheet",
    intro: "Shortcuts active while browsing a cheatsheet, editing its layout, or using Developer Mode.",
  },
];

export const SUB_SUB_TABS: SubSubTabConfig[] = [
  {
    id: "general",
    label: "General",
    intro: "Shortcuts active while browsing a cheatsheet.",
    contexts: ["sheet"],
  },
  {
    id: "layout",
    label: "Layout",
    intro: "Shortcuts active while editing the layout of a cheatsheet. Each sub-mode (Navigation, Move, Resize) has its own set of bindings.",
    contexts: ["layout", "layout-navigation", "layout-move", "layout-resize"],
  },
  {
    id: "developer",
    label: "Developer",
    intro: "Shortcuts active in Developer Mode and its sub-modes.",
    contexts: ["dev", "dev-logs", "dev-axes"],
  },
];

export function getActiveContexts(
  sub: KeybindingsSubTab,
  subSub: KeybindingsSubSubTab,
): { contexts: KeybindingContext[]; intro: string } {
  if (sub === "cheatsheet") {
    const subConfig = SUB_SUB_TABS.find((t) => t.id === subSub) ?? SUB_SUB_TABS[0];
    return { contexts: subConfig.contexts, intro: subConfig.intro };
  }
  const subConfig = SUB_TABS.find((t) => t.id === sub) ?? SUB_TABS[0];
  return { contexts: subConfig.contexts ?? [], intro: subConfig.intro };
}
