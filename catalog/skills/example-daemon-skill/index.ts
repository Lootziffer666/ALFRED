// plan §31 — Example Skill: ein einfacher, sicherer Custom Job ohne LLM-Output.

import type { Job, JobContext, JobResult } from "../../../lib/daemon/jobs/types.js";

export const exampleDaemonSkill: Job = {
  name: "example-daemon-skill",

  async run(_jc: JobContext): Promise<JobResult> {
    return {
      status: "ok",
      findings: [],
      writes: [],
    };
  },
};
