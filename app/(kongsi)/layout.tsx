import { TopBar } from "@/components/kongsi/TopBar";
import { BottomNav } from "@/components/kongsi/BottomNav";

export default function KongsiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="grain min-h-screen">
      <TopBar cartCount={2} notifCount={5} />
      <main className="relative z-[2] pb-[84px]">{children}</main>
      <BottomNav />
    </div>
  );
}
