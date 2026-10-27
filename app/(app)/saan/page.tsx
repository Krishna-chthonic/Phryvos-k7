import { SaanChat } from "@/components/saan/SaanChat";

export const metadata = {
  title: "Saan — Living Companion",
  description: "A genuine, living soul companion inside K7.",
};

export default function SaanPage() {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col justify-center">
      <SaanChat />
    </div>
  );
}
