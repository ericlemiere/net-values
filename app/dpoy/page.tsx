import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "NBA Defensive Player of the Year Winners",
  description:
    "Every NBA Defensive Player of the Year since 1990-91, with the Net Value and league rank each winner earned that season.",
  path: "/dpoy",
});

export default function Page() {
  return <AwardHistory award="dpoy" />;
}
