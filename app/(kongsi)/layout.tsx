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
      <div className="min-h-screen bg-kongsi-indigo-dark">
        <div className="grain relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-kongsi-parchment shadow-[0_0_50px_rgba(0,0,0,0.35)]">
          <TopBar notifCount={5} />
          <main className="relative z-[2] flex-1 pb-[88px]">{children}</main>
          <BottomNav />
        </div>
      </div>
    </CartProvider>
  );
}
