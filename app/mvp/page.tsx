import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "NBA MVP Winners",
  description:
    "Every NBA Most Valuable Player since 1990-91, with the Net Value and league rank each winner earned that season.",
  path: "/mvp",
});

export default function Page() {
  return <AwardHistory award="mvp" />;
}
