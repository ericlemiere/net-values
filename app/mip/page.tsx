import { AwardHistory } from "@/components/AwardHistory";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Most Improved Player",
  description:
    "Every NBA Most Improved Player winner, with the Net Value each earned that season.",
  path: "/mip",
});

export default function Page() {
  return <AwardHistory award="mip" />;
}
