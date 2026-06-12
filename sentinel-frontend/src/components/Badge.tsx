import { cn } from '@/lib/utils';

type Variant =
  | 'active' | 'in_progress' | 'completed' | 'scheduled' | 'missed' | 'overdue'
  | 'critical' | 'high' | 'medium' | 'low'
  | 'open' | 'resolved' | 'closed'
  | 'default';

const VARIANTS: Record<Variant, string> = {
  active:      'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed:   'bg-green-100 text-green-700 border-green-200',
  scheduled:   'bg-gray-100 text-gray-600 border-gray-200',
  missed:      'bg-red-100 text-red-700 border-red-200',
  overdue:     'bg-orange-100 text-orange-700 border-orange-200',
  critical:    'bg-red-100 text-red-700 border-red-200',
  high:        'bg-orange-100 text-orange-700 border-orange-200',
  medium:      'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:         'bg-green-100 text-green-700 border-green-200',
  open:        'bg-red-50 text-red-600 border-red-200',
  resolved:    'bg-green-50 text-green-600 border-green-200',
  closed:      'bg-gray-100 text-gray-500 border-gray-200',
  default:     'bg-gray-100 text-gray-600 border-gray-200',
};

interface BadgeProps {
  variant?: string;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const key = (variant?.toLowerCase().replace(' ', '_') || 'default') as Variant;
  const style = VARIANTS[key] || VARIANTS.default;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', style, className)}>
      {children}
    </span>
  );
}
