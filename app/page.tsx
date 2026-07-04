import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-semibold mb-3">The Net Values</h1>
      <p className="text-white/60 mb-8 max-w-md">
        NBA player stats (1989-90 to present), advanced stats, and salaries.
      </p>
      <nav className="flex gap-4">
        <Link
          href="/stats"
          className="px-4 py-2 rounded border border-white/20 hover:bg-accent hover:text-black hover:border-accent transition-colors"
        >
          Stats
        </Link>
        <Link
          href="/advanced-stats"
          className="px-4 py-2 rounded border border-white/20 hover:bg-accent hover:text-black hover:border-accent transition-colors"
        >
          Advanced Stats
        </Link>
        <Link
          href="/salaries"
          className="px-4 py-2 rounded border border-white/20 hover:bg-accent hover:text-black hover:border-accent transition-colors"
        >
          Salaries
        </Link>
      </nav>
    </div>
  );
}
