import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin Preview | First Class Styles",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function AdminPreviewLayout({ children }: { children: ReactNode }) {
  return children;
}
