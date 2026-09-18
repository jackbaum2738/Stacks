import type { Metadata, Viewport } from "next";
import { Newsreader, Karla, IBM_Plex_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Stacks",
  description: "Track and share a home library of physical books.",
};

// `viewport-fit=cover` lets the fixed mobile bottom tab bar pad itself by
// `env(safe-area-inset-bottom)` instead of sitting under the iOS home
// indicator / Android gesture bar.
export const viewport: Viewport = {
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("stacks:theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${karla.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Runs before paint so an explicit theme choice applies with no flash of the OS default. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
