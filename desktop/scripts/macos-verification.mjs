import { spawnSync } from "node:child_process";

function result(program, args) {
  const execution = spawnSync(program, args, { encoding: "utf8" });
  if (execution.error) throw execution.error;
  if (execution.signal) throw new Error(`${program} stopped by ${execution.signal}`);
  return { exitCode: execution.status, output: `${execution.stdout ?? ""}\n${execution.stderr ?? ""}` };
}

// Verification never repairs/re-signs a bad producer artifact.
export function verifyMacBundle(app, expectedIdentifier) {
  const verified = result("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
  if (verified.exitCode !== 0)
    throw new Error(`Application bundle signature verification failed:\n${verified.output.trim()}`);
  const description = result("/usr/bin/codesign", ["-d", "--verbose=4", app]);
  if (description.exitCode !== 0) throw new Error("Cannot inspect verified application signature.");
  const field = (name) => description.output.split("\n").find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1);
  const identifier = field("Identifier");
  if (identifier !== expectedIdentifier)
    throw new Error(`Code signature identifier ${identifier ?? "(missing)"} does not match ${expectedIdentifier}.`);
  const team = field("TeamIdentifier");
  const signature = field("Signature");
  const developerID = description.output.includes("Authority=Developer ID Application:");
  const ticket = result("/usr/bin/xcrun", ["stapler", "validate", app]);
  const gatekeeper = result("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", app]);
  return {
    strictVerification: "passed",
    kind: signature === "adhoc" ? "ad-hoc" : developerID ? "developer-id" : "other",
    identifier,
    teamIdentifier: team && team !== "not set" ? team : null,
    notarizationTicket: {
      status: ticket.exitCode === 0 ? "validated" : /does not have a ticket stapled/i.test(ticket.output) ? "absent" : "unverified",
      exitCode: ticket.exitCode,
    },
    gatekeeper: {
      status: gatekeeper.exitCode === 0 ? "accepted" : /\brejected\b/.test(gatekeeper.output) ? "rejected" : "unverified",
      exitCode: gatekeeper.exitCode,
    },
  };
}
