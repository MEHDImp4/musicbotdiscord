import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DISCORD_TOKEN ??= "test-token";
process.env.DISCORD_CLIENT_ID ??= "test-client";
process.env.IDLE_TIMEOUT_SECONDS ??= "1";
process.env.EMPTY_CHANNEL_TIMEOUT_SECONDS ??= "1";
// Keep persistence side effects out of the repository's data/ directory.
process.env.DATA_DIR ??= mkdtempSync(join(tmpdir(), "pulse-data-"));
