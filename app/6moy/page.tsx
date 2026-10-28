import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "NBA Sixth Man of the Year Winners",
  description:
    "Every NBA Sixth Man of the Year since 1990-91, with the Net Value and league rank each winner earned that season.",
  path: "/6moy",
});

export default function Page() {
  return <AwardHistory award="smoy" />;
}
