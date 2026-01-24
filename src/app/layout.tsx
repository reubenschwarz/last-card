import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Last Card",
  description: "A classic card game for 2-4 players",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="no-select antialiased">{children}</body>
    </html>
  );
}
