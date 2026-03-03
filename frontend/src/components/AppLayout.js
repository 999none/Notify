import React from 'react';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0F172A]" data-testid="app-layout">
      <Sidebar />
      <main className="ml-[240px] min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
