import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col md:items-center md:justify-center p-6 md:text-center">
      <img src="/tnv-transparent.png" alt="The Net Values Logo" className="hidden md:block mb-4 w-[50vw] max-w-80" />
      <h1 className="mb-3 text-4xl font-semibold tracking-tight">
        The Net Values
      </h1>
      <p className="text-white/80 mb-4 md:mb-8 max-w-md">
        A way to evaluate an NBA player's Net Value based on their production on
        the court and salary.
      </p>
      <nav className="flex flex-col md:flex md:flex-row gap-3 md:gap-4">
        <Link
          href="/salaries"
          className="whitespace-nowrap rounded-md border border-accent bg-background-box/90 px-2 md:px-4 py-1.5 md:py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Salaries
        </Link>
        <Link
          href="/teams"
          className="whitespace-nowrap rounded-md border border-accent bg-background-box/90 px-2 md:px-4 py-1.5 md:py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Teams
        </Link>
        <Link
          href="/stats"
          className="whitespace-nowrap rounded-md border border-accent bg-background-box/90 px-2 md:px-4 py-1.5 md:py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Stats
        </Link>
        <Link
          href="/advanced-stats"
          className="whitespace-nowrap rounded-md border border-accent bg-background-box/90 px-2 md:px-4 py-1.5 md:py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Advanced Stats
        </Link>
        <Link
          href="/net-value"
          className="rounded-md border border-accent bg-background-box/90 px-2 md:px-4 py-1.5 md:py-2 transition-colors hover:border-accent hover:bg-accent hover:text-black"
        >
          Net Value
        </Link>
      </nav>
      <img src="/tnv-transparent.png" alt="The Net Values Logo" className="block absolute bottom-0 left-4 md:hidden mb-4 w-[40vw]" />
    </div>
  );
}
