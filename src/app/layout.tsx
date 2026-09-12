import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zev Lock",
  description: "Zev Lock — premium license platform",
  applicationName: "Zev Lock",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Zev Lock" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/zev-character.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }, { url: "/zev-character.png", type: "image/png", sizes: "512x512" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#05060f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
