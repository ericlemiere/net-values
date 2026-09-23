import { AwardHistory } from "@/components/AwardHistory";

export const metadata = {
  title: "Most Valuable Player - The Net Values",
  description: "Every NBA Most Valuable Player winner, with the Net Value each earned that season.",
};

export default function Page() {
  return <AwardHistory award="mvp" />;
}
