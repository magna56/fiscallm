import { NavLinks } from "./nav-links";

export async function Nav({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  return <NavLinks appId={appId} />;
}
