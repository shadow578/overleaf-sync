import {
    debug as debug_log,
    info as info_log,
    error as error_log
} from "@actions/core";
import * as yauzl from "yauzl-promise";
import { default as sanitizeFilename } from "sanitize-filename";
import * as fs from "fs";
import * as fsp from "fs/promises";
import path from "path";
import OverleafClient from "./client/OverleafClient";
import { Stream, Writable } from "stream";

type ActionArgs = {
    /**
     * authentification data
     */
    auth: {
        /**
         * hostname of the overleaf CE instance
         */
        host: string,

        /**
         * email of the user to use for login
         */
        email: string,

        /**
         * password of the user to to use for login
         */
        password: string;
    },

    /**
     * a list of project ids or names that should be included when downloading.
     * if not set, all projects are included
     */
    projects?: string[],

    /**
     * path to download the projects to
     */
    downloads_path: string,

    /**
     * automatically accept all invites before loading projects
     */
    accept_invites: boolean,

    /**
     * filter out all projects that werent changed after the given date
     * if not set, none are filtered
     */
    changed_after?: Date;
};

/**
 * run the workflow
 * 
 * @param args workflow args
 */
export default async function run(args: ActionArgs) {
    // create client and login 
    const overleaf = new OverleafClient(args.auth.host);
    await overleaf.login(args.auth.email, args.auth.password);
    debug_log(`logged in to ${args.auth.host} with user ${args.auth.email}`);

    // accept all pending invites
    if (args.accept_invites) {
        debug_log(`checking for invites`);
        for (const invite of (await overleaf.getInvites())) {
            debug_log(`accepting invite to join ${invite.projectName} by ${invite.username}...`);
            await overleaf.acceptInvite(invite).catch(err => {
                error_log(`failed to accept invite for ${invite.projectName}`);
            });
        }
    }

    // get all available projects and remove deleted and archived projects
    let projects = await overleaf.getProjects();
    projects = projects.filter(p => !p.archived && !p.trashed);

    // filter by selection
    if (args.projects) {
        debug_log(`applying project id/name filter`);
        projects = projects.filter(p => {
            return args.projects?.includes(p.id) || args.projects?.includes(p.name);
        });
    }

    // filter projects by change date
    if (args.changed_after) {
        debug_log(`applying project change date filter with n < ${args.changed_after}`);
        projects = projects.filter(p => {
            // default to including if not valid
            if (!p.lastUpdated) return true;
            const lastModified = Date.parse(p.lastUpdated);

            // only include if changed after target date
            return isNaN(lastModified) || lastModified >= args.changed_after!!.getTime();
        });
    }

    // download all projects and extract to downloads dir
    debug_log(`got ${projects.length} projects`);
    for (const project of projects) {
        // build directory for the project
        const projectDir = path.join(args.downloads_path, sanitizeFilename(project.name));
        debug_log(`downloading project ${project.id} to ${projectDir}`);

        // remove previous contents
        await fsp.rm(projectDir, {
            recursive: true,
            force: true
        });

        // download project as .zip file
        const zipPath = path.join(projectDir, "project.zip");
        await pipe(
            await overleaf.downloadProject(project),
            await createWriteStreamAndDir(zipPath)
        );

        // unzip the project
        debug_log(`unzipping project.zip`);
        const zip = await yauzl.open(zipPath);
        await zip.walkEntries(async entry => {
            const p = path.join(projectDir, entry.fileName);
            debug_log(`writing ${entry.fileName} to ${p}`);
            await pipe(
                await zip.openReadStream(entry),
                await createWriteStreamAndDir(p)
            );
        });
        await zip.close();

        // remove project .zip file
        await fsp.rm(zipPath);
    }

    // log out of overleaf
    debug_log(`logging out...`);
    overleaf.logout();
}

async function pipe(source: Stream, destination: Writable) {
    await new Promise(resolve => {
        source.pipe(destination).on("finish", resolve);
    });
}

async function createWriteStreamAndDir(filePath: string) {
    await fsp.mkdir(path.dirname(filePath), {
        recursive: true
    });

    return fs.createWriteStream(filePath, {
        autoClose: true
    });
}
