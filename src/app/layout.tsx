import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";
import { THEME_COOKIE, THEMES } from "@/lib/themes";

// Runs before first paint so the chosen theme never flashes in as white.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([a-z]+)/);var t=m&&m[1];if(t&&${JSON.stringify(THEMES.map((t) => t.id))}.indexOf(t)>=0)document.documentElement.dataset.theme=t;}catch(e){}})();`;

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
    <html lang="ru" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
