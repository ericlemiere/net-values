import { AwardHistory } from "@/components/AwardHistory";

export const metadata = {
  title: "Sixth Man of the Year - The Net Values",
  description: "Every NBA Sixth Man of the Year winner, with the Net Value each earned that season.",
};

export default function Page() {
  return <AwardHistory award="smoy" />;
}
