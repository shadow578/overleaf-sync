import * as core from '@actions/core';
import * as fs from "fs";
import * as fsp from "fs/promises";
import run from "./action";

async function main() {
  // parse action inputs
  const host = core.getInput("host", { required: true });
  const email = core.getInput("email", { required: true });
  const password = core.getInput("password", { required: true });
  const downloads_path = core.getInput("downloads_path", { required: true });
  const accept_invites = !!core.getBooleanInput("accept_invites", { required: false });
  const force_download = !!core.getBooleanInput("force_download", { required: false });

  // parse project filters
  const projectsRaw = core.getInput("projects", { required: false });
  let projects: string[] | undefined;
  if (projectsRaw) {
    projects = projectsRaw.split(/\r?\n/).map(s => {
      s = s.trim();
      if (s.at(0) === s.at(-1)) {
        s = s.substring(1, s.length - 1);
      }
      return s;
    });
  }

  // parse tag filters
  const tagsRaw = core.getInput("tags", { required: false });
  let tags: string[] | undefined;
  if (tagsRaw) {
    tags = tagsRaw.split(/\r?\n/).map(s => {
      s = s.trim();
      if (s.at(0) === s.at(-1)) {
        s = s.substring(1, s.length - 1);
      }
      return s;
    });
  }

  // get last run time
  let changed_after: Date | undefined;
  if (!force_download && fs.existsSync(".lastrun")) {
    core.debug(`reading last run information`);
    const lastRunRaw = await fsp.readFile(".lastrun", "utf8");
    const lastRun = Date.parse(lastRunRaw);
    if (!isNaN(lastRun)) {
      changed_after = new Date(lastRun);
      core.debug(`last run parsed as ${changed_after}`);
    }
  }

  // execute the action
  await run({
    auth: {
      host,
      email,
      password
    },
    projects,
    tags,
    accept_invites,
    downloads_path,
    changed_after
  });

  // write last run time
  if (!force_download) {
    core.debug(`writing last run information`);
    await fsp.writeFile(".lastrun", new Date().toISOString(), "utf-8");
  }
}
main().catch(err => {
  core.setFailed(err.message);
});
