import type { Metadata } from "next";
import { 
  Inter, 
  Poppins, 
  Outfit, 
  Plus_Jakarta_Sans,
  Manrope,
  DM_Sans
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoginPromptProvider } from "@/contexts/LoginPromptContext";

// Tipografías disponibles para probar
const inter = Inter({ subsets: ["latin"] });
const poppins = Poppins({ 
  subsets: ["latin"], 
  weight: ["300", "400", "500", "600", "700", "800"] 
});
const outfit = Outfit({ subsets: ["latin"] });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });
const manrope = Manrope({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

// Cambiar esta variable para probar diferentes tipografías
const currentFont = plusJakarta; // 🔥 Prueba: poppins, outfit, plusJakarta, manrope, dmSans, inter

export const metadata: Metadata = {
  title: "Savela - Comparte ofertas increíbles",
  description: "Descubre y comparte las mejores ofertas de productos en Argentina",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", sizes: "32x32", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${currentFont.className} antialiased bg-gray-50`}>
        <AuthProvider>
          <LoginPromptProvider>
            {children}
          </LoginPromptProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
