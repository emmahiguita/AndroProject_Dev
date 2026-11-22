import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ANDROIS — Control Android & iOS Studio",
  description: "Control, transmisión, diagnóstico y mantenimiento profesional de dispositivos Android e iOS",
  icons: { icon: "/favicon.png", apple: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${plusJakartaSans.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var isExtErr = function(val) {
                    if (!val) return false;
                    var s = typeof val === 'string' ? val : (val.stack || val.message || '');
                    return String(s).indexOf('chrome-extension://') !== -1 || String(s).indexOf('moz-extension://') !== -1;
                  };
                  window.addEventListener('error', function(ev) {
                    if (isExtErr(ev.filename) || isExtErr(ev.error)) {
                      ev.stopImmediatePropagation();
                      ev.preventDefault();
                    }
                  }, true);
                  window.addEventListener('unhandledrejection', function(ev) {
                    if (isExtErr(ev.reason)) {
                      ev.stopImmediatePropagation();
                      ev.preventDefault();
                    }
                  }, true);

                  var removeExtAttrs = function() {
                    var els = document.querySelectorAll('[bis_skin_checked]');
                    for (var i = 0; i < els.length; i++) {
                      els[i].removeAttribute('bis_skin_checked');
                    }
                  };
                  removeExtAttrs();
                  if (typeof MutationObserver !== 'undefined') {
                    var obs = new MutationObserver(function(mutations) {
                      for (var i = 0; i < mutations.length; i++) {
                        var m = mutations[i];
                        if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked' && m.target && m.target.removeAttribute) {
                          m.target.removeAttribute('bis_skin_checked');
                        }
                      }
                    });
                    obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['bis_skin_checked'] });
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
