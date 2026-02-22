import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "LGCID Operations Dashboard",
  description: "Lower Gardens CID weekly operations performance dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
