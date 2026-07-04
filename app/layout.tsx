import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--ff-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  style: ["normal", "italic"],
});

const workSans = Work_Sans({
  variable: "--ff-work",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kongsi Dagang — Jalur Rempah Nusantara",
  description:
    "Balai lelang, neraca harga, dan loji para saudagar — satu jalur perdagangan tempat kamu menawar, menimbang, dan berbelanja.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${fraunces.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
