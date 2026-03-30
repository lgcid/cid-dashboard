import type { Metadata } from "next";
import Script from "next/script";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "LGCID Operations Dashboard",
  description: "Lower Gardens CID weekly operations performance dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script
          id="hs-script-loader"
          src="https://js-eu1.hs-scripts.com/139563873.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
