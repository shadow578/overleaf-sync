import axios from "axios";
import * as HTMLParser from "node-html-parser";
import { Stream } from "stream";
import OverleafBaseClient from "./BaseClient";
import { OverleafProject, OverleafProjectItem, OverleafTagItem, ProjectInvite } from "./Model";

/**
 * a client for interacting with Overleaf community edition
 */
export default class OverleafClient extends OverleafBaseClient {
    //#region auth
    /**
     * login a user and save the session id for further use.
     * 
     * @param email the username / email
     * @param password the plain password
     */
    async login(email: string, password: string) {
        // request the login page to get a initial session id
        const initialResponse = await axios.get(this.getUrl("/login"));
        this.updateSessionId(initialResponse);
        this.requireSession();

        // get a csrf token
        //const csrf = await this.getCSRFToken();

        const csrf = HTMLParser.parse(initialResponse.data)
            .querySelector(`meta[name="ol-csrfToken"]`)
            ?.getAttribute("content");

        // authentificate with username and password
        const loginResponse = await axios.post(this.getUrl("/login"), {
            email: email,
            password: password,
            "_csrf": csrf
        }, {
            headers: {
                ...this.sessionHeaders,
                "x-csrf-token": csrf
            }
        });

        // update the session
        this.updateSessionId(loginResponse);

        // ensure the login was sucessfull
        if (!this.session || loginResponse.status != 200) {
            throw new Error(`login failed: ${loginResponse.statusText}`);
        }
    }

    /**
    * log the client out.
    * only valid if the client is logged in
    */
    async logout() {
        this.requireSession();

        // get a csrf token
        const csrf = await this.getCSRFToken();

        // do logout
        await axios.post(this.getUrl("/logout"), {
            "_csrf": csrf
        }, {
            headers: {
                ...this.sessionHeaders,
                "x-csrf-token": csrf
            }
        });

        // clear session
        this.session = undefined;
    }
    //#endregion

    //#region invites
    /**
     * get all pending invites for the currently logged- in user
     * 
     * @returns a list of all pending invites
     */
    async getInvites(): Promise<ProjectInvite[]> {
        this.requireSession();

        // query the projects overview page
        const response = await axios.get(this.getUrl("/project"), {
            headers: this.sessionHeaders
        });
        this.updateSessionId(response);

        // get and parse notifications data
        const notificationsJson = HTMLParser.parse(response.data)
            .querySelector(`meta[name="ol-notifications"]`)
            ?.getAttribute("content");
        if (!notificationsJson) {
            throw new Error("notification data was empty");
        }

        const notifications = JSON.parse(notificationsJson);
        if (notifications === undefined
            || notifications === null
            || !Array.isArray(notifications)) {
            throw new Error("failed to parse notification data");
        }

        // map notifications to invites
        return notifications.filter(n => n && n.templateKey === "notification_project_invite")
            .map(n => {
                return {
                    projectName: n.messageOpts.projectName,
                    projectId: n.messageOpts.projectId,
                    token: n.messageOpts.token,
                };
            })
            .filter(n => typeof (n.projectId) === "string"
                && typeof (n.projectName) === "string"
                && typeof (n.token) === "string");
    }

    /**
    * accept a invitation to a project
    * 
    * @param invite the project invite to accept
    */
    async acceptInvite(invite: { projectId: string, token: string; }) {
        this.requireSession();

        // get csrf token
        const csrf = await this.getCSRFToken();

        // query the projects overview page
        const response = await axios.post(this.getUrl(`/project/${invite.projectId}/invite/token/${invite.token}/accept`), {}, {
            headers: {
                ...this.sessionHeaders,
                "x-csrf-token": csrf,
            }
        });
        this.updateSessionId(response);
    }
    //#endregion

    //#region projects
    /**
     * get all projects the user created
     * 
     * @returns a list of all projects the user has created
     */
    async getProjects(): Promise<OverleafProject[]> {
        this.requireSession();

        // query the projects overview page
        const response = await axios.get(this.getUrl("/project"), {
            headers: this.sessionHeaders
        });
        this.updateSessionId(response);

        // parse html from response
        const html = HTMLParser.parse(response.data);

        // parse raw projects and tags
        const projects = this.parseProjectItems(html);
        const tags = this.parseTagItems(html);

        // map each project and tag item to a overleaf project object
        return projects.map(pi => {
            let tagNames = tags.filter(t => t.project_ids?.includes(pi.id)).map(t => t.name);
            let lastUpdate = new Date(pi.lastUpdated || "");
            return {
                id: pi.id,
                name: pi.name,
                tags: tagNames,
                isArchived: pi.archived,
                isTrashed: pi.trashed,
                lastUpdated: isNaN(lastUpdate.getTime()) ? undefined : lastUpdate
            };
        });

    }

    /**
     * parse projects data from the overleaf project overview page
     * 
     * @param html the html of the projects page
     * @returns the projects parsed
     */
    private parseProjectItems(html: HTMLParser.HTMLElement): OverleafProjectItem[] {
        // get and parse list of projects
        const projectsJson = html
            .querySelector(`meta[name="ol-projects"]`)
            ?.getAttribute("content");
        if (!projectsJson) {
            throw new Error("projects data was empty");
        }

        const projects = JSON.parse(projectsJson);
        if (projects === undefined
            || projects === null
            || !Array.isArray(projects)
            || !projects.every((project: any) =>
                typeof (project.id) === "string"
                && typeof (project.name) === "string"
                && typeof (project.archived) === "boolean"
                && typeof (project.trashed) === "boolean")) {
            throw new Error("failed to parse projects data");
        }

        return projects;
    }

    /**
     * parse tag data from the overleaf project overview page
     * 
     * @param html the html of the projects page
     * @returns the tags parsed
     */
    private parseTagItems(html: HTMLParser.HTMLElement): OverleafTagItem[] {
        // get and parse tags data
        const tagsJson = html
            .querySelector(`meta[name="ol-tags"]`)
            ?.getAttribute("content");
        if (!tagsJson) {
            throw new Error("tags data was empty");
        }

        const tags = JSON.parse(tagsJson);
        if (tags === undefined
            || tags === null
            || !Array.isArray(tags)
            || !tags.every((tag: any) => typeof (tag.name) === "string"
                && Array.isArray(tag.project_ids)
                && tag.project_ids.every((pi: any) => typeof (pi) === "string"))) {
            throw new Error("failed to parse tags data");
        }

        return tags;
    }

    /**
    * download a project's source files as a .zip file
    * 
    * @param project the project to download
    * @returns a stream of the project .zip file
    */
    async downloadProject(project: { id: string; }): Promise<Stream> {
        this.requireSession();

        // request the download of the project as a zip file
        const response = await axios.get(this.getUrl(`/project/${project.id}/download/zip`), {
            headers: this.sessionHeaders,
            responseType: "stream"
        });
        this.updateSessionId(response);

        // return the response stream
        return response.data;
    }
    //#endregion
}
