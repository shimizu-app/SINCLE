import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { PressFeedback } from "@/components/PressFeedback";
import "./globals.css";

// 見出しから本文まで同じ書体で通す。Zen Maru Gothic は
// 環境にある場合のフォールバックとして globals.css で指定している。
const rounded = M_PLUS_Rounded_1c({
  weight: ["400", "500", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-rounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SYNCLE",
  description: "名刺から始まる営業CRM",
};

export const viewport: Viewport = {
  themeColor: "#FDFAF4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={rounded.variable}>
      <body className="antialiased">
        <PressFeedback />
        {children}
      </body>
    </html>
  );
}
