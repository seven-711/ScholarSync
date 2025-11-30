
import React, { useState } from 'react';
import { LogOut, GraduationCap, LayoutDashboard, ScrollText, Users, FileCheck, Menu, X, ChevronRight, MessageCircleQuestion } from 'lucide-react';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  notifications?: { [key: string]: number };
}

export const Layout: React.FC<LayoutProps> = ({ children, role, activeTab, onTabChange, onLogout, notifications = {} }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const adminLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scholars', label: 'Scholars', icon: Users },
    { id: 'announcements', label: 'Announcements', icon: ScrollText },
    { id: 'assignments', label: 'Assignments', icon: FileCheck },
    { id: 'inquiries', label: 'Inquiries', icon: MessageCircleQuestion },
  ];

  const scholarLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assignments', label: 'My Assignments', icon: FileCheck },
    { id: 'inquiries', label: 'Contact Support', icon: MessageCircleQuestion },
  ];

  const links = role === UserRole.ADMIN ? adminLinks : scholarLinks;

  const handleNavClick = (id: string) => {
    onTabChange(id);
    setIsMobileMenuOpen(false);
  };

  // Theme configuration
  const isAdmin = role === UserRole.ADMIN;
  
  // Admin: Gradient Orange to Amber
  // Scholar: Gradient Red-900 (Maroon) to Rose-900
  const sidebarClass = isAdmin 
    ? 'bg-gradient-to-b from-orange-600 to-amber-500 text-white' 
    : 'bg-gradient-to-b from-red-950 to-rose-900 text-white';
    
  const mobileHeaderClass = isAdmin
    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white'
    : 'bg-gradient-to-r from-red-950 to-rose-900 text-white';

  const activeLinkClass = 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/10';
  const inactiveLinkClass = 'text-white/70 hover:bg-white/10 hover:text-white';

  const iconBgClass = isAdmin ? 'bg-white/20 text-white' : 'bg-white/20 text-white';

  return (
    <div className="h-screen bg-gray-50 flex flex-col md:flex-row overflow-hidden">
      
      {/* Mobile Top Bar */}
      <div className={`md:hidden fixed top-0 left-0 right-0 z-30 h-16 flex items-center justify-between px-4 border-b border-white/10 shadow-sm ${mobileHeaderClass}`}>
        <div className="flex items-center gap-2">
           <div className={`p-1.5 rounded-lg ${iconBgClass}`}>
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">ScholarSync</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="p-2 rounded-md hover:bg-white/10 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar / Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out 
        md:relative md:translate-x-0 md:h-screen flex flex-col
        md:shadow-none shadow-2xl
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarClass}
      `}>
        
        {/* Sidebar Header */}
        <div className="p-6 flex items-center gap-3 h-20 md:h-24 border-b border-white/10">
          <div className={`p-2.5 rounded-xl shadow-lg ${iconBgClass}`}>
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="flex flex-col">
             <span className="font-bold text-xl tracking-tight leading-none text-white">
               ScholarSync
             </span>
             <span className="text-[11px] font-bold uppercase tracking-wider mt-1 text-white/80">
               {isAdmin ? 'Admin Portal' : 'Scholar Portal'}
             </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <p className="px-4 text-xs font-bold uppercase tracking-widest mb-4 text-white/50">
            Main Menu
          </p>
          {links.map((link) => {
            const isActive = activeTab === link.id;
            const notificationCount = notifications[link.id] || 0;

            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive ? activeLinkClass : inactiveLinkClass
                }`}
              >
                <div className="flex items-center gap-3 relative">
                  <link.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                  {link.label}
                  
                  {/* Notification Badge */}
                  {notificationCount > 0 && (
                    <span className={`
                      ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse
                      ${isAdmin ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'}
                      shadow-sm
                    `}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </div>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-white/80" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 mx-4 mb-4 rounded-xl border border-white/10 bg-black/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
            <span className="text-xs font-medium text-white/70">
              System Online
            </span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors border border-white/20 text-white/80 hover:bg-white/10 hover:text-white hover:border-white/40"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pt-20 md:pt-0 h-screen overflow-hidden flex flex-col w-full bg-gray-50/50">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 md:px-10 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20 md:pb-10 min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
