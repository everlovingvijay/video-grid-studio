import React from 'react';
import {
  Scissors,
  Layers,
  SlidersHorizontal,
  Tv,
  BookOpen,
  Info,
} from 'lucide-react';

export type ActiveTab = 'split' | 'reassemble' | 'compare' | 'wall' | 'docs';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasSplitTiles: boolean;
  hasReassembledVideo: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  hasSplitTiles,
  hasReassembledVideo,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'split',
      label: 'Split Grid',
      icon: <Scissors className="w-5 h-5" />,
      badge: hasSplitTiles ? 'Ready' : undefined,
    },
    {
      id: 'reassemble',
      label: 'Reassemble',
      icon: <Layers className="w-5 h-5" />,
      badge: hasReassembledVideo ? 'Done' : undefined,
    },
    {
      id: 'compare',
      label: 'Seam & Compare',
      icon: <SlidersHorizontal className="w-5 h-5" />,
    },
    {
      id: 'wall',
      label: 'Video Wall',
      icon: <Tv className="w-5 h-5" />,
    },
    {
      id: 'docs',
      label: 'Docs & Tests',
      icon: <BookOpen className="w-5 h-5" />,
    },
  ];

  return (
    <aside className="w-16 lg:w-48 bg-studio-900 border-r border-studio-800 flex flex-col justify-between py-3 select-none shrink-0 z-20">
      <div className="space-y-1 px-2">
        <div className="px-3 py-1.5 hidden lg:block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Workflows
        </div>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center lg:space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-studio-accent text-white shadow-lg shadow-studio-accent/25'
                  : 'text-slate-400 hover:text-white hover:bg-studio-800/80'
              }`}
            >
              <span className={`shrink-0 ${isActive ? 'text-white' : 'group-hover:text-studio-accent'}`}>
                {item.icon}
              </span>
              <span className="hidden lg:inline truncate">{item.label}</span>

              {item.badge && (
                <span className="hidden lg:inline-block ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {item.badge}
                </span>
              )}

              {/* Tooltip on mobile / collapsed icon */}
              <div className="lg:hidden absolute left-full ml-2 px-2 py-1 bg-studio-800 text-white text-xs rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50">
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-3 pt-3 border-t border-studio-800/60 hidden lg:block text-slate-500 text-[11px]">
        <div className="flex items-center space-x-1.5 text-slate-400 font-semibold mb-1">
          <Info className="w-3.5 h-3.5" />
          <span>Client Static</span>
        </div>
        <p className="leading-tight">
          Runs 100% in your browser. No files are ever uploaded to any server.
        </p>
      </div>
    </aside>
  );
};
