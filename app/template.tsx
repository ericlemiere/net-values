/**
 * Next re-keys a template on every navigation (a layout persists instead), so
 * the entrance animation on this wrapper replays per page. That's the only
 * reason it exists — no state, no data.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade flex flex-1 flex-col">{children}</div>;
}
