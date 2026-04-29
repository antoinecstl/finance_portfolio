import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fi-hub.subleet.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fi-Hub — Suivi de patrimoine PEA, CTO, AV, livrets",
    template: "%s · Fi-Hub",
  },
  description:
    "Fi-Hub regroupe vos PEA, CTO, livrets et assurances-vie en un tableau de bord unique. Valorisation en temps réel, dividendes, historique. Gratuit pour démarrer.",
  applicationName: "Fi-Hub",
  keywords: [
    "suivi patrimoine",
    "suivi PEA",
    "suivi CTO",
    "tableau de bord patrimoine",
    "alternative Finary",
    "tracker portefeuille bourse",
    "dividendes ETF",
    "agrégateur patrimoine français",
    "valorisation portefeuille temps réel",
    "assurance-vie suivi",
  ],
  authors: [{ name: "Fi-Hub" }],
  creator: "Fi-Hub",
  publisher: "Fi-Hub",
  category: "finance",
  alternates: {
    canonical: "/",
    languages: { "fr-FR": "/" },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "Fi-Hub",
    title: "Fi-Hub — Suivez votre patrimoine sans Excel",
    description:
      "PEA, CTO, livrets, assurances-vie : un tableau de bord unique, valorisé en temps réel. Dividendes, historique complet, multi-comptes.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Fi-Hub — Suivi de patrimoine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fi-Hub — Suivez votre patrimoine sans Excel",
    description:
      "Regroupez PEA, CTO, livrets et assurances-vie. Valorisation temps réel, dividendes, historique.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: { icon: "/icon.png", apple: "/icon.png" },
  formatDetection: { telephone: false, email: false, address: false },
  verification: {
    google: "H4-TUj5dMXFozw0CkqiEt2cFSG41tGhFHaY1kkFqu9g",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
