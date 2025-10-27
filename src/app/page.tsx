import GameCanvas from "../components/GameCanvas";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between px-6 py-3">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">揉团子解压小游戏</h1>
        <a
          className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          href="#"
        >
          实验原型
        </a>
      </header>
      <main className="flex flex-1">
        <GameCanvas />
      </main>
    </div>
  );
}
