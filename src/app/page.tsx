import { HomeClient } from "@/app/home-client";
import { getAllCheatSheetsMeta } from "@/lib/yaml-cheatsheets";

export default async function Home() {
  const sheets = await getAllCheatSheetsMeta();
  return <HomeClient sheets={sheets} />;
}
