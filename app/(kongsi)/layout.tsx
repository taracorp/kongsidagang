import { TopBar } from "@/components/kongsi/TopBar";
import { BottomNav } from "@/components/kongsi/BottomNav";
import { CartProvider } from "@/components/kongsi/cart";

export default function KongsiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CartProvider>
      <div className="grain min-h-screen">
        <TopBar notifCount={5} />
        <main className="relative z-[2] pb-[84px]">{children}</main>
        <BottomNav />
      </div>
    </CartProvider>
  );
}
