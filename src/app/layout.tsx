// src/app/layout.tsx
import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacturApp – Gestion de facturation",
  description: "Application de gestion de facturation et stock",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        {process.env.NEXT_PUBLIC_APP_ENV === "DEV" && (
          <div className="bg-yellow-300 text-black text-center py-1 font-bold">
            MODE DÉVELOPPEMENT - BASE LOCALE
          </div>
        )}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
