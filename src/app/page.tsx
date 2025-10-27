import GameCanvas from "../components/GameCanvas";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between px-6 py-3">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">揉团子解压小游戏</h1>
        {/* 移除右上角按钮文案 */}
      </header>
      <main className="flex flex-1">
        <GameCanvas />
      </main>
    </div>
  );
}
