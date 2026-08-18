import {
  Briefcase,
  ClipboardList,
  Feather,
  HeartHandshake,
  Sprout,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Icon names are stored as strings on the category record, resolved here. */
const ICONS: Record<string, LucideIcon> = {
  Sprout,
  HeartHandshake,
  Feather,
  Briefcase,
  ClipboardList,
  Users,
};

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sprout;
  return <Icon className={className} aria-hidden />;
}
