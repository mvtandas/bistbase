import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChangeBadgeProps {
  change: number | null;
}

export function ChangeBadge({ change }: ChangeBadgeProps) {
  if (change == null) {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        —
      </Badge>
    );
  }

  const isPositive = change >= 0;

  return (
    <Badge
      className={cn(
        "font-medium border",
        isPositive
          ? "bg-gain/10 text-gain border-gain/20 hover:bg-gain/10"
          : "bg-loss/10 text-loss border-loss/20 hover:bg-loss/10"
      )}
    >
      {isPositive ? "+" : ""}
      {change.toFixed(2)}%
    </Badge>
  );
}
