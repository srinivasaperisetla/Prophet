import type { Metadata } from "next";
import { Inter_Tight, Roboto_Mono, Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter_tight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
})

const roboto_mono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Prophet",
  description: "Real-time +EV and Arbritrage identifier for Sports Betting and Prediction Markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en" className={cn("font-sans", geist.variable)}
    >
      <body className={`${inter_tight.variable} ${roboto_mono.variable} min-h-screen antialiased`}>
        <ClerkProvider>
          <Navbar />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
