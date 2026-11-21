import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";

const manrope = Manrope({
  variable: "--font-jakarta",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Uspeyka — планер дел",
  applicationName: "Uspeyka",
  appleWebApp: {
    capable: true,
    title: "Uspeyka",
    statusBarStyle: "default",
  },
  description: "Планер на день, неделю и месяц с достижениями",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
