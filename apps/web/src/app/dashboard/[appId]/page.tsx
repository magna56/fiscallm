import { redirect } from "next/navigation";
import { Suspense } from "react";

// The overview page arrives in step 8b; until then, start at setup.
export default function AppPage({ params }: PageProps<"/dashboard/[appId]">) {
  return (
    <Suspense>
      <ToSetup params={params} />
    </Suspense>
  );
}

async function ToSetup({ params }: Pick<PageProps<"/dashboard/[appId]">, "params">): Promise<null> {
  redirect(`/dashboard/${(await params).appId}/setup`);
}
