import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/ui/pwa-register";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ondda - Sistema de Gestão para Distribuidoras",
  description: "Pedidos, produção, financeiro, NF-e e loja online. A plataforma completa para distribuidoras.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ondda",
  },
  icons: {
    apple: "/ondda-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e40af",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
