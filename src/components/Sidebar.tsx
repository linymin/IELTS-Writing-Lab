'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BookOpen, 
  BarChart2, 
  History, 
  Settings, 
  TrendingUp,
  HelpCircle,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  PenTool,
  LogOut
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
}

const NavItem = ({ href, icon, label, isCollapsed }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link href={href}>
      <div 
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors relative group",
          isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white",
          isCollapsed && "justify-center px-2"
        )}
        title={isCollapsed ? label : undefined}
      >
        <div className="shrink-0">
          {icon}
        </div>
        {!isCollapsed && (
          <span className="whitespace-nowrap overflow-hidden transition-all duration-300">
            {label}
          </span>
        )}
        
        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            {label}
          </div>
        )}
      </div>
    </Link>
  );
};

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

import { useLanguage } from '@/lib/i18n/LanguageContext';
import { signout } from '@/app/login/actions';
import { UserAvatar } from './UserAvatar';

export const Sidebar = ({ isCollapsed, toggleSidebar }: SidebarProps) => {
  const { t } = useLanguage();

  return (
    <div 
      className={cn(
        "bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col z-20 transition-all duration-300 ease-in-out border-r border-slate-800",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header / Logo Area */}
      <div className={cn(
        "flex items-center h-20 px-6 mb-2 transition-all",
        isCollapsed ? "justify-center px-0" : "justify-between"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <BookOpen className="w-8 h-8 text-blue-400 shrink-0" />
            <span className="text-xl font-bold tracking-tight whitespace-nowrap">{t('sidebar.title')}</span>
          </div>
        )}
        
        {isCollapsed && (
           <BookOpen className="w-8 h-8 text-blue-400 shrink-0" />
        )}

        {/* Toggle Button - Visible in expanded mode (top right) */}
        {!isCollapsed && (
          <button 
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Toggle Button - Visible in collapsed mode (centered) */}
      {isCollapsed && (
        <div className="flex justify-center mb-6">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 space-y-2 px-3">
        <NavItem isCollapsed={isCollapsed} href="/workshop" icon={<PenTool className="w-6 h-6" />} label={t('sidebar.workshop')} />
        <NavItem isCollapsed={isCollapsed} href="/questions" icon={<HelpCircle className="w-6 h-6" />} label={t('sidebar.questions')} />
        <NavItem isCollapsed={isCollapsed} href="/improvement" icon={<TrendingUp className="w-6 h-6" />} label={t('sidebar.improvement')} />
        <NavItem isCollapsed={isCollapsed} href="/history" icon={<History className="w-6 h-6" />} label={t('sidebar.history')} />
        <NavItem isCollapsed={isCollapsed} href="/settings" icon={<Settings className="w-6 h-6" />} label={t('sidebar.settings')} />
        
        <button
            onClick={() => signout()}
            className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors relative group text-slate-400 hover:bg-slate-800 hover:text-white",
            isCollapsed && "justify-center px-2"
            )}
            title={isCollapsed ? t('sidebar.signout') : undefined}
        >
            <div className="shrink-0">
            <LogOut className="w-6 h-6" />
            </div>
            {!isCollapsed && (
            <span className="whitespace-nowrap overflow-hidden transition-all duration-300">
                {t('sidebar.signout')}
            </span>
            )}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                {t('sidebar.signout')}
            </div>
            )}
        </button>
      </nav>

      {/* User Profile */}
      <div className={cn(
        "p-4 border-t border-slate-800 flex items-center gap-3 mt-auto",
        isCollapsed ? "justify-center" : ""
      )}>
        <UserAvatar />
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
             <span className="text-sm font-medium text-white truncate">My Profile</span>
             <span className="text-xs text-slate-500 truncate">Manage Account</span>
          </div>
        )}
      </div>

      {/* Footer / Version */}
      <div className={cn(
        "px-6 pb-6 pt-2 text-slate-600 text-xs transition-all",
        isCollapsed && "hidden"
      )}>
        v1.0.0 (Beta)
      </div>
    </div>
  );
};
