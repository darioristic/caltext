import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${inter.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
