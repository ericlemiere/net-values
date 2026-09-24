import { PAGE_COLUMN, PAGE_COLUMN_PROSE } from "@/lib/layout";
import { Spinner } from "./Spinner";

/**
 * The shared `loading.tsx` body for every data route.
 *
 * `width` has to match the page it stands in for. The column is left-anchored,
 * so the title and spinner already come up on the same gutter either way — but
 * a prose route pads itself more tightly on a phone, and matching that here is
 * what keeps the heading from nudging sideways as the real page arrives.
 */
export function PageLoading({
  title,
  width = "wide",
}: {
  title: string;
  width?: "wide" | "prose";
}) {
  return (
    <div className={width === "prose" ? PAGE_COLUMN_PROSE : PAGE_COLUMN}>
      <div className="mb-4 flex items-center gap-4 md:min-h-11.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="w-fit flex items-center gap-3 rounded-lg bg-white/5 px-4 py-8 text-sm text-white/70">
        <Spinner />
        Loading {title.toLowerCase()}
      </div>
    </div>
  );
}
