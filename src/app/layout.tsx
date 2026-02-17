import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAILBREAK - 탈옥 대작전",
  description: "3D 탈옥 액션 게임 - Three.js + Next.js",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
