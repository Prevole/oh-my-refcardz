import { HomeClient } from "@/app/home-client";
import { getAllCheatSheetsMeta } from "@/lib/yaml-cheatsheets";

export default async function Home() {
  const categories = await getAllCheatSheetsMeta();
  return <HomeClient categories={categories} />;
}
