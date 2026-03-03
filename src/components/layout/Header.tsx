"use client";

import { Bell, User } from "lucide-react";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-[#111827] px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-gray-400">Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
