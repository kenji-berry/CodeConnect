import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./Components/NavBar";

export const metadata: Metadata = {
  title: "CodeConnect",
  description: "Making Open Source More Personal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
