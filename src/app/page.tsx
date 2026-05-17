import KoreaMap from "@/components/map/KoreaMapClient";
import { getPoliticianPins } from "@/lib/queries/politician-pins";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { pins, proportionalTotal } = await getPoliticianPins();
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between border-b border-zinc-200 px-6 py-2.5 dark:border-zinc-800">
        <h1 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          세금으로 일하는 사람들, 제대로 일하나요?
        </h1>
        <p className="text-xs text-zinc-500">
          22대 국회 · 지역구 {pins.length}명 · 비례 {proportionalTotal}명
        </p>
      </div>
      <main className="relative min-h-0 flex-1">
        <KoreaMap pins={pins} proportionalTotal={proportionalTotal} />
      </main>
    </div>
  );
}
