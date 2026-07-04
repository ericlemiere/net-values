import Link from "next/link";

export function PlayerLink({ id, name }: { id: number; name: string }) {
  return (
    <Link href={`/players/${id}`} className="hover:underline">
      {name}
    </Link>
  );
}
