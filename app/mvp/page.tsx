import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Most Valuable Player",
  description:
    "Every NBA Most Valuable Player winner, with the Net Value each earned that season.",
  path: "/mvp",
});

export default function Page() {
  return <AwardHistory award="mvp" />;
}
