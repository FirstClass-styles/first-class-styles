import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Preview | First Class Styles",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function AdminPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
