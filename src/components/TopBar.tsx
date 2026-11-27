import React from 'react';
import { User } from 'firebase/auth';

export type ActiveTab = 'overview' | 'students' | 'judging' | 'judges';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  authLoading: boolean;
}

const NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: 'overview', label: '전체 현황' },
  { id: 'students', label: '1~30번 학생' },
  { id: 'judging', label: '심사평가' },
  { id: 'judges', label: '심사위원' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  user,
  onSignIn,
  onSignOut,
  authLoading,
}) => {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          학생 홈페이지 경진대회
        </button>

        {/* Zone 2: 4 single-line text navigation links */}
        {user ? (
          <nav
            aria-label="주요 메뉴"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'border-blue-600 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Zone 3: Single primary action button */}
        <div className="shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={authLoading}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {user.displayName ? `${user.displayName} · 로그아웃` : '로그아웃'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Google 로그인
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      {user && (
        <nav
          aria-label="모바일 메뉴"
          className="md:hidden border-t border-slate-100 px-4 flex items-center gap-4 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-blue-600 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
