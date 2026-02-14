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
  LogOut,
  Loader2,
  CheckCircle,
  Play,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useEvaluation } from '@/lib/context/evaluation-context';

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
  const { isEvaluating, progress, isComplete, currentStage, elapsedSeconds, cancelEvaluation } = useEvaluation();
  const pathname = usePathname();
  
  // Show progress if evaluating OR complete
  // Hide if on evaluating page OR report page
  // Hide if just started (elapsedSeconds < 1) to prevent flash during initial redirect
  // EXCEPTION: If we are in the rewrite flow (activeEvaluationId exists), we might be on a "rewrite" page, 
  // but we still want to hide the sidebar progress if we are technically on the /evaluating page.
  // The issue: "Run in Background" from rewrite -> evaluating page -> click -> stays on evaluating page?
  // No, the issue is: From rewrite page, we submit -> go to /evaluating. 
  // If we click "Back" or "Minimize", we are now on the previous page (RewriteClient).
  // RewriteClient IS the page where we want to see the progress bar!
  // BUT the check `!pathname.startsWith('/evaluation/')` hides it because RewriteClient is at `/evaluation/[id]/rewrite`!
  
  const isRewritePage = pathname.includes('/rewrite');

  const showProgress = (isEvaluating || isComplete) 
    && pathname !== '/evaluating' 
    && (!pathname.startsWith('/evaluation/') || isRewritePage) // Allow showing on rewrite pages
    && elapsedSeconds > 0;

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
        <NavItem isCollapsed={isCollapsed} href="/questions" icon={<HelpCircle className="w-6 h-6" />} label={t('sidebar.questions')} />
        <NavItem isCollapsed={isCollapsed} href="/diagnostics" icon={<BarChart2 className="w-6 h-6" />} label={t('sidebar.diagnostics')} />
        <NavItem isCollapsed={isCollapsed} href="/history" icon={<History className="w-6 h-6" />} label={t('sidebar.history')} />
        <NavItem isCollapsed={isCollapsed} href="/settings" icon={<Settings className="w-6 h-6" />} label={t('sidebar.settings')} />
      </nav>

      {/* Progress Indicator (Above Profile) */}
      {showProgress && (
         <div className="px-3 pb-4 relative">
            {/* Cancel Button (Visible only when not collapsed and not complete) */}
            {!isCollapsed && !isComplete && (
               <button 
                  onClick={(e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     cancelEvaluation();
                  }}
                  className="absolute -top-1 -right-1 z-20 bg-slate-700 text-slate-400 hover:text-white hover:bg-red-500 rounded-full p-1 shadow-md transition-colors transform scale-75 hover:scale-100"
                  title="Cancel Evaluation"
               >
                  <X className="w-3 h-3" />
               </button>
            )}

            <Link href={isComplete && useEvaluation().evaluationId ? `/evaluation/${useEvaluation().evaluationId}` : "/evaluating"}>
              <div className={cn(
                "rounded-xl bg-slate-800 border border-slate-700 overflow-hidden cursor-pointer hover:bg-slate-750 transition-colors group relative",
                isCollapsed ? "p-2 flex justify-center" : "p-3"
              )}>
                
                {isCollapsed ? (
                   // Collapsed State: Circular Progress
                   <div className="relative w-8 h-8 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                         <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-700" />
                         <circle 
                           cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="transparent" 
                           strokeDasharray={2 * Math.PI * 14}
                           strokeDashoffset={2 * Math.PI * 14 * (1 - progress / 100)}
                           className={isComplete ? "text-green-500" : "text-blue-500"}
                         />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                         {isComplete ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                      </div>
                   </div>
                ) : (
                   // Expanded State: Detailed Status
                   <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                         <span className={isComplete ? "text-green-400" : "text-blue-400"}>
                            {isComplete ? "Complete!" : "Analyzing..."}
                         </span>
                         <span className="text-slate-400">{Math.round(progress)}%</span>
                      </div>
                      
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                         <div 
                           className={cn("h-full transition-all duration-500 ease-out", isComplete ? "bg-green-500" : "bg-blue-500")}
                           style={{ width: `${progress}%` }}
                         />
                      </div>
                      
                      {isComplete && (
                        <div className="flex items-center gap-1 text-[10px] text-green-400/80 mt-1">
                           <Play className="w-3 h-3 fill-current" />
                           <span>Click to view report</span>
                        </div>
                      )}
                   </div>
                )}
              </div>
            </Link>
         </div>
      )}

      {/* User Profile */}
      <Link href="/profile">
        <div className={cn(
          "p-4 border-t border-slate-800 flex items-center gap-3 mt-auto hover:bg-slate-800 transition-colors cursor-pointer",
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
      </Link>

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
