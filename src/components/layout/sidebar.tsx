"use client";

import { useState, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Profile } from "@/types";

const SidebarContext = createContext({ collapsed: false });

export function useSidebar() {
  return useContext(SidebarContext);
}

const overviewLinks = [
  { href: "/", label: "Home", icon: LayoutDashboardIcon, exact: true },
  { href: "/listings", label: "Listings", icon: ListIcon },
];

const setupLinks = [
  { href: "/setup/profile", label: "Buyer Profile", icon: UserIcon },
  { href: "/setup/kumo", label: "Kumo Settings", icon: SettingsIcon },
];

const adminLinks = [
  { href: "/admin/scrape-logs", label: "Scrape Logs", icon: ClockArrowIcon },
  { href: "/admin/prompts", label: "Prompts", icon: FileTextIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

interface SidebarProps {
  profile: Profile;
  children: React.ReactNode;
}

export function SidebarLayout({ profile, children }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const initials = (profile.display_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ease-in-out",
            collapsed ? "w-[68px]" : "w-[240px]"
          )}
        >
          {/* Logo & collapse toggle */}
          <div className={cn(
            "flex items-center h-14 border-b border-gray-100 shrink-0",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}>
            {!collapsed && (
              <Link href="/" className="flex items-center gap-2.5">
                <img src="/logo.svg" alt="BizScout" className="w-8 h-8 shrink-0" />
                <span className="text-lg font-bold text-gray-900">BizScout</span>
              </Link>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors",
                collapsed && "mx-auto"
              )}
            >
              {collapsed ? (
                <ChevronRightIcon className="w-4 h-4" />
              ) : (
                <ChevronLeftIcon className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-6">
            {/* Overview */}
            <NavSection label="OVERVIEW" collapsed={collapsed}>
              {overviewLinks.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  icon={link.icon}
                  active={link.exact ? pathname === link.href : pathname.startsWith(link.href)}
                  collapsed={collapsed}
                />
              ))}
            </NavSection>

            {/* Setup */}
            <NavSection label="SETUP" collapsed={collapsed}>
              {setupLinks.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  icon={link.icon}
                  active={pathname === link.href}
                  collapsed={collapsed}
                />
              ))}
            </NavSection>

            {/* Admin */}
            {profile.role === "admin" && (
              <NavSection label="ADMIN" collapsed={collapsed}>
                {adminLinks.map((link) => (
                  <NavItem
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={pathname.startsWith(link.href)}
                    collapsed={collapsed}
                  />
                ))}
              </NavSection>
            )}
          </nav>

          {/* User section */}
          <div className={cn(
            "border-t border-gray-100 p-3",
            collapsed ? "flex justify-center" : ""
          )}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger
                  onClick={handleSignOut}
                  className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">Click to sign out</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {profile.display_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Sign out"
                >
                  <LogOutIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main
          className={cn(
            "flex-1 min-h-screen transition-all duration-200 ease-in-out",
            collapsed ? "ml-[68px]" : "ml-[240px]"
          )}
        >
          {children}
        </main>

        {/* Mobile overlay */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
          <nav className="flex items-center justify-around h-14 px-2">
            {overviewLinks.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium",
                    active ? "text-primary" : "text-gray-400"
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/setup/profile"
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium",
                pathname.startsWith("/setup") ? "text-primary" : "text-gray-400"
              )}
            >
              <SettingsIcon className="w-5 h-5" />
              Setup
            </Link>
          </nav>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

function NavSection({
  label,
  collapsed,
  children,
}: {
  label?: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      {label && !collapsed && (
        <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
      )}
      {label && collapsed && (
        <div className="mx-auto w-6 border-t border-gray-200 my-2" />
      )}
      {children}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
}) {
  const inner = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg transition-colors",
        collapsed ? "justify-center p-2.5 mx-auto" : "px-3 py-2",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      )}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {!collapsed && <span className="text-sm">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>{inner}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

// ---------- Icons ----------

function LayoutDashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function ClockArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}


function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
