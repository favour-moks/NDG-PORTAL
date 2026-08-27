import type { Metadata } from "next";
import { Rubik, JetBrains_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

// Matches nigerdeltagames.com's typeface, per the brand alignment pass.
const rubik = Rubik({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NDG Payment Accreditation Portal",
  description: "The system of record for NDG accreditation and payments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${rubik.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
