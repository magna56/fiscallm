import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children, params }: LayoutProps<"/dashboard/[appId]">) {
  return (
    <Suspense fallback={<div className="flex-1 bg-[#f7f7fb]" />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ params, children }: { params: Promise<{ appId: string }>; children: React.ReactNode }) {
  return <AppShell appId={(await params).appId}>{children}</AppShell>;
}
