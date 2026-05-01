import { SheetGrid, SheetCard } from "@/components/sheet-grid";
import { SheetCommand } from "@/components/sheet-command";
import { SheetShortcut } from "@/components/sheet-shortcut";
import type { YamlCheatSheet, CheatSheetItem } from "@/lib/yaml-cheatsheets";
import styles from "./sheet-rendering.module.css";

type Props = {
  sheet: YamlCheatSheet;
};

export function YamlSheetRenderer({ sheet }: Props) {
  return (
    <>
      {sheet.sections.map((section) => (
        <div key={section.title}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          <SheetGrid>
            {section.cards.map((card) => (
              <SheetCard key={card.title} title={card.title}>
                {card.items.map((item, index) => (
                  <div key={index}>
                    {index > 0 && <hr className={styles.itemDivider} />}
                    <SheetItem item={item} />
                  </div>
                ))}
              </SheetCard>
            ))}
          </SheetGrid>
        </div>
      ))}
    </>
  );
}

function SheetItem({ item }: { item: CheatSheetItem }) {
  if (item.type === "command") {
    return (
      <SheetCommand
        title={item.title}
        command={item.command}
        description={item.description}
        example={item.examples?.[0]}
      />
    );
  }

  if (item.type === "shortcut") {
    return <SheetShortcut keys={item.keys} description={item.description} />;
  }

  return null;
}
