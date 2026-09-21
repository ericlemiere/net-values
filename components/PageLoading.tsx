import { Spinner } from "./Spinner";

/** The shared `loading.tsx` body for every data route. */
export function PageLoading({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-350 p-6 text-white">
      <div className="mb-4 flex items-center gap-4 md:min-h-11.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-3 rounded-lg border-2 border-accent bg-white/5 px-4 py-8 text-sm text-white/70">
        <Spinner />
        Loading {title.toLowerCase()}
      </div>
    </div>
  );
}
