'use client';

import React from 'react';
import { LucideIcon, Tractor, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { EmulationRequiredState } from '@/components/roles/EmulationRequiredState';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Tractor,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 md:p-16 rounded-xl text-center shadow-sm flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 flex items-center justify-center text-green-600 dark:text-green-400 shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{title}</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{description}</p>
      </div>
      {actionLabel && (actionHref || onAction) && (
        <div className="pt-2">
          <Button href={actionHref} onClick={onAction} variant="success" size="md" icon={Plus}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmptyFarmState({
  title = 'No tienes campos registrados',
  description = 'Primero debes registrar un campo para poder acceder a esta sección y gestionar tu establecimiento.',
  actionLabel = 'Registrar Mi Primer Campo',
  actionHref = '/farms/new',
}: Partial<EmptyStateProps>) {
  const { user, emulatedUser } = useAuth();

  if (user?.globalRole === 'SUPER_ADMIN' && !emulatedUser) {
    return <EmulationRequiredState title="los Recursos del Campo" />;
  }

  return (
    <EmptyState
      icon={Tractor}
      title={title}
      description={description}
      actionLabel={actionLabel}
      actionHref={actionHref}
    />
  );
}
