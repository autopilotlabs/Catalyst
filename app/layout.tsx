import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";
import { WorkspaceSelector } from "@/components/workspace-selector";
import { SearchCommandPalette } from "@/components/search/SearchCommandPalette";

export const metadata: Metadata = {
  title: "Catalyst",
  description: "Catalyst Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <SignedIn>
            <SearchCommandPalette />
          </SignedIn>
          <header className="flex justify-between items-center p-4 border-b">
            <SignedOut>
              <div className="flex gap-4">
                <SignInButton />
                <SignUpButton />
              </div>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-4">
                <WorkspaceSelector />
                <UserButton />
              </div>
            </SignedIn>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

