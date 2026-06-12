import { Card } from "./Card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatProps {
  title: string;
  value: string | number;
  change?: number;
  suffix?: string;
  icon: React.ReactNode;
}

export function StatCard({ title, value, change, suffix, icon }: StatProps) {
  const positive = change && change > 0;
  const negative = change && change < 0;

  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-sm text-text-muted">{title}</p>
        <p className="text-2xl font-semibold text-primary mt-1">
          {value}
          {suffix && <span className="text-sm font-normal text-text-muted ml-1">{suffix}</span>}
        </p>
        {change !== undefined && (
          <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", positive && "text-success", negative && "text-danger", !positive && !negative && "text-text-muted")}>
            {positive && <TrendingUp size={14} />}
            {negative && <TrendingDown size={14} />}
            {!positive && !negative && <Minus size={14} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="p-2.5 rounded-lg bg-accent/10 text-accent">{icon}</div>
    </Card>
  );
}
