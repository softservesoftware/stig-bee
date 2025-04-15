import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stig Bee",
  description: "A beautiful and modern stig viewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex items-center gap-2 m-4">
          <Image
            src="/stigbee-minimal.png"
            alt="StigBee Logo"
            width={40}
            height={40}
            className="object-contain rounded-lg"
          />
          <h1 className="text-4xl font-bold">Stigbee</h1>
        </div>
        {children}
      </body>
    </html>
  );
}
