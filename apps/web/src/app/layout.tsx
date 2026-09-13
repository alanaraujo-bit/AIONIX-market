import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { NativeBehavior } from "@/components/native-behavior";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aionix-market.vercel.app"),
  manifest: "/manifest.webmanifest",
  title: { default: "AIONIX Market", template: "%s · AIONIX Market" },
  description: "Seu supermercado premium no bolso. Hortifruti fresco, ofertas do dia e entrega rápida.",
  applicationName: "AIONIX Market",
  appleWebApp: { capable: true, title: "AIONIX", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  // Next only emits the standard `mobile-web-app-capable`; iOS < 17.4 still reads the Apple-prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f6f4ee",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        <Providers>
          <NativeBehavior />
          {/* App frame: full-bleed on phones, device-like column on larger screens. */}
          <div className="fixed inset-0 flex justify-center">
            <div
              id="app"
              className="relative flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-canvas min-[520px]:shadow-[0_0_0_1px_rgb(15_26_20/0.06),0_30px_80px_-20px_rgb(15_26_20/0.25)]"
            >
              {children}
              <Toaster />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
