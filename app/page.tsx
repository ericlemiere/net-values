import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-3 text-4xl font-semibold tracking-tight">The Net Values</h1>
      <p className="text-white/60 mb-8 max-w-md">
        NBA player stats (1989-90 to present), advanced stats, and salaries.
      </p>
      <nav className="flex gap-4">
        <Link
          href="/stats"
          className="rounded-md border border-white/20 px-4 py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Stats
        </Link>
        <Link
          href="/advanced-stats"
          className="rounded-md border border-white/20 px-4 py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Advanced Stats
        </Link>
        <Link
          href="/salaries"
          className="rounded-md border border-white/20 px-4 py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Salaries
        </Link>
      </nav>
    </div>
  );
}
