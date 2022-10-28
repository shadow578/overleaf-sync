/**
 * a project in overleaf
 */
export type OverleafProject = {
    id: string,
    name: string,
    archived: boolean,
    trashed: boolean,
    lastUpdated?: string,
    lastUpdatedBy?: OverleafUser,
    owner?: OverleafUser;
};

/**
 * a user of overleaf
 */
export type OverleafUser = {
    email: string,
    first_name?: string,
    last_name?: string;
};

/**
 * a inviation to a overleaf project
 */
export type ProjectInvite = {
    projectName: string,
    projectId: string,
    username: string,
    token: string,
    expires: string;
};