import type { Metadata } from "next";
import { Space_Grotesk, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Match Note",
  description:
    "Anonymous match opinions, clustered and summarized into topic pulses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${spaceGrotesk.variable} ${fraunces.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
