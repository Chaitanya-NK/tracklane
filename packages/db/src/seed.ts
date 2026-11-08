import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const { db } = await import("./client");

async function main() {
  await db.appSetting.upsert({
    where: { key: "schema.phase" },
    update: { value: { phase: 0 } },
    create: { key: "schema.phase", value: { phase: 0 } },
  });
  console.warn("Seed complete (phase 0).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
