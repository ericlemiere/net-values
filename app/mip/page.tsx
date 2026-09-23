import { AwardHistory } from "@/components/AwardHistory";

export const metadata = {
  title: "Most Improved Player - The Net Values",
  description: "Every NBA Most Improved Player winner, with the Net Value each earned that season.",
};

export default function Page() {
  return <AwardHistory award="mip" />;
}
