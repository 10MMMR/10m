import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Nunito } from "next/font/google";
import { AuthProvider } from "./_global/authentication/auth-context";
import { SiteFooter } from "./_components/site-footer";
import { ThemeTogglePill } from "./_components/theme-toggle-pill";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "10M Study",
  description:
    "AI study app focused on mock exams, adaptive weaknesses, smart flashcards, and concise summaries.",
  icons: {
    icon: "/10m_logo.ico",
    shortcut: "/10m_logo.ico",
  },
};

const themeInitScript = `
  (() => {
    try {
      const stored = localStorage.getItem("theme");
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const nextTheme = stored === "dark" || stored === "light"
        ? stored
        : systemPrefersDark
          ? "dark"
          : "light";
      document.documentElement.dataset.theme = nextTheme;
    } catch (_err) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      data-theme="light"
      className={`${fraunces.variable} ${nunito.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeTogglePill />
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
