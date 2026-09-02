import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  breadcrumbs: string[];
  title: string;
}

export function PageHeader({ breadcrumbs, title }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 pb-6 select-none w-full">
      <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            <span>{crumb}</span>
            {index < breadcrumbs.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
          </React.Fragment>
        ))}
      </div>
      <h2 className="text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none mt-1">
        {title}
      </h2>
    </div>
  );
}
