import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Defensive Player of the Year",
  description:
    "Every NBA Defensive Player of the Year winner, with the Net Value each earned that season.",
  path: "/dpoy",
});

export default function Page() {
  return <AwardHistory award="dpoy" />;
}
