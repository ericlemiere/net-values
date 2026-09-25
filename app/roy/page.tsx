import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Rookie of the Year",
  description:
    "Every NBA Rookie of the Year winner, with the Net Value each earned that season.",
  path: "/roy",
});

export default function Page() {
  return <AwardHistory award="roy" />;
}
