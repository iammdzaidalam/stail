import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/session-shared";
import type { Role } from "@/lib/definitions";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    // Stale-but-valid token (user deleted/deactivated): clear it via /logout
    // instead of looping against the proxy's /login redirect.
    const store = await cookies();
    redirect(store.get(SESSION_COOKIE) ? "/logout" : "/login");
  }

  return (
    <div className="min-h-dvh">
      <Sidebar
        role={user.role as Role}
        user={{
          id: user.id,
          name: user.name,
          hue: user.avatarHue,
          title: user.title,
        }}
      />
      <div className="flex min-h-dvh flex-col lg:pl-[260px]">
        <Topbar user={user} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-28 pt-6 md:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileNav role={user.role as Role} />
    </div>
  );
}
