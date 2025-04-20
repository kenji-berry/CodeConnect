import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./Components/NavBar";
import { AuthStateListener } from './Components/AuthStateListener';
import Footer from "./Components/Footer";

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
        <AuthStateListener />
        {children}
        <Footer />
      </body>
    </html>
  );
}
