'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  // Pages that don't show the sidebar or top bar (like login)
  const isPublicPage = pathname === '/login' || pathname.startsWith('/auth');

  if (isPublicPage) {
    return (
      <LanguageProvider>
        <div className="min-h-screen bg-slate-50">
          {children}
        </div>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />
        
        <main 
          className={cn(
            "transition-all duration-300 ease-in-out min-h-screen",
            isCollapsed ? "ml-20" : "ml-64",
            "p-4" 
          )}
        >
          <div className="w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </LanguageProvider>
  );
}
