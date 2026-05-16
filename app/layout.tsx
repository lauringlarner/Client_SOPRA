import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VisionQuest",
  description: "sopra-fs26-group18-client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        {/* --- GLOBAL ORIENTATION BLOCKER --- */}
        <div className="orientation-blocker">
          <div className="blocker-container">
            <svg 
              className="blocker-svg"
              viewBox="0 0 24 24" 
              width="56" 
              height="56" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
            <h3 className="blocker-title">Rotate Device</h3>
            <p className="blocker-text">
              VisionQuest is optimized for portrait mode only. Please flip your device vertically.
            </p>
          </div>
        </div>

        {/* --- ANT DESIGN & CORE GLOBAL PROVIDERS --- */}
        <ConfigProvider
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              // General theme tokens mapped from your project structure variables
              colorPrimary: "#22426b", 
              borderRadius: 8,
              colorText: "#fff",
              fontSize: 16,
              colorBgContainer: "#16181D",
            },
            components: {
              Button: {
                colorPrimary: "#75bd9d", 
                controlHeight: 38,
              },
              Input: {
                colorBorder: "gray", 
                colorTextPlaceholder: "#888888",
              },
              Form: {
                labelColor: "#fff",
              },
              Card: {},
            },
          }}
        >
          <AntdRegistry>
            <AntdApp>{children}</AntdApp>
          </AntdRegistry>
        </ConfigProvider>
      </body>
    </html>
  );
}