import React from "react";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  category: string;
  title: string;
  description?: string;
  actionButton?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ category, title, description, actionButton }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
          <span>{category}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-blue-600 dark:text-blue-400 font-medium">{title}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actionButton && <div className="shrink-0">{actionButton}</div>}
    </div>
  );
};

export default PageHeader;
