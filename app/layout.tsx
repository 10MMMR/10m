import type { Metadata } from "next";
import { AuthProvider } from "./_global/authentication/auth-context";
import { SiteFooter } from "./_components/site-footer";
import { SiteNavbar } from "./_components/site-navbar";
import { ThemeTogglePill } from "./_components/theme-toggle-pill";
import "./globals.css";


export const metadata: Metadata = {
  title: "10M Study",
  description:
    "AI study app focused on mock exams, adaptive weaknesses, smart flashcards, and concise summaries.",
  icons: {
    icon: "/sprout.ico",
    shortcut: "/sprout.ico",
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
      className="h-full scroll-smooth antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeTogglePill />
          <SiteNavbar />
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
