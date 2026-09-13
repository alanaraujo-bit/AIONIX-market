import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "AIONIX Admin", template: "%s · AIONIX Admin" },
  description: "Painel operacional do AIONIX Market",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f1a14" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${bricolage.variable}`}>
      <body className="h-dvh overflow-hidden">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 14 } }}
          />
        </Providers>
      </body>
    </html>
  );
}
