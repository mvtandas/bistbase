import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="text-xl font-bold tracking-tight text-foreground">
        bist<span className="text-ai-primary">base</span>
      </span>
    </Link>
  );
}
