import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  NotebookPen,
  Radio,
  ScrollText,
  Settings2,
  TreePalm,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  ADMIN_ROLES,
  MANAGERIAL_ROLES,
  ORG_ROLES,
  type Role,
} from "@/lib/definitions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted = visible to everyone. */
  roles?: Role[];
};

export type NavSection = { label: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/attendance", label: "My Attendance", icon: CalendarDays },
      { href: "/tasks", label: "My Tasks", icon: ListChecks },
      { href: "/reports", label: "Daily Reports", icon: NotebookPen },
      { href: "/leave", label: "Leave & Requests", icon: TreePalm },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/team", label: "Team Overview", icon: Users, roles: MANAGERIAL_ROLES },
      { href: "/team/live", label: "Live Status", icon: Radio, roles: MANAGERIAL_ROLES },
      {
        href: "/team/reports",
        label: "Team Reports",
        icon: NotebookPen,
        roles: MANAGERIAL_ROLES,
      },
      { href: "/approvals", label: "Approvals", icon: Inbox, roles: MANAGERIAL_ROLES },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/announcements", label: "Announcements", icon: Megaphone },
      { href: "/org", label: "Organization", icon: BarChart3, roles: ORG_ROLES },
      { href: "/people", label: "People", icon: UsersRound, roles: ORG_ROLES },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/admin/registrations",
        label: "Registrations",
        icon: UserPlus,
        roles: ADMIN_ROLES,
      },
      { href: "/admin/teams", label: "Teams", icon: Users, roles: ADMIN_ROLES },
      { href: "/admin/policies", label: "Policies", icon: Settings2, roles: ADMIN_ROLES },
      {
        href: "/admin/holidays",
        label: "Holidays",
        icon: CalendarRange,
        roles: ADMIN_ROLES,
      },
      { href: "/admin/audit", label: "Audit Log", icon: ScrollText, roles: ADMIN_ROLES },
    ],
  },
];

export function sectionsForRole(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
