import { backfillSignalOutcomes } from "../src/lib/cron/backfill-signal-outcomes";

async function main() {
  console.log("Starting signal outcome backfill...");
  const result = await backfillSignalOutcomes();
  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
