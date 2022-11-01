/**
 * a project in overleaf
 */
export type OverleafProject = {
    id: string,
    name: string,
    tags: string[],
    isArchived: boolean,
    isTrashed: boolean,
    lastUpdated?: Date;
};

/**
 * a inviation to a overleaf project
 */
export type ProjectInvite = {
    projectName: string,
    projectId: string,
    token: string;
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
 * raw project data, internal use only
 */
export type OverleafProjectItem = {
    id: string,
    name: string,
    archived: boolean,
    trashed: boolean,
    lastUpdated?: string,
    lastUpdatedBy?: OverleafUser,
    owner?: OverleafUser;
};

/**
 * raw tag data, internal use only
 */
export type OverleafTagItem = {
    name: string,
    project_ids: string[];
};