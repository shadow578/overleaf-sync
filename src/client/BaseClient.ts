import axios, { AxiosResponse } from "axios";
import * as CookieParser from "set-cookie-parser";

/**
 * base class for overleaf client, handles core functionality
 */
export default abstract class OverleafBaseClient {
    /**
    * the current session id, undefined if not logged in
    */
    protected session: string | undefined;

    protected csrf: string | undefined;

    /**
     * create a new overleaf client
     * 
     * @param host the url on which overleaf is hosted
     */
    constructor(private host: string) { }

    /**
     * get session headers (Cookie).
     * only valid if logged in
     */
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    protected get sessionHeaders(): any {
        this.requireSession();
        return {
            "Cookie": `sharelatex.sid=${this.session}`,
            "Origin": this.host
        };
    }

    /**
     * get a csrf token
     * 
     * @returns a new csrf token
     */
    protected async getCSRFToken(): Promise<string> {
        this.requireSession();

        // get csrf token from dispenser
        const response = await axios.get(this.getUrl("/dev/csrf"), {
            headers: this.sessionHeaders
        });

        return response.data;
    }

    /**
     * build a full url from a relative path
     * 
     * @param path the path to add to the url
     * @returns the full url
     */
    protected getUrl(path: string): string {
        return `${this.host}${path}`;
    }

    /**
     * update the session id from the cookies in the given response
     * @param response the response to parse the session id cookie from
     */
    protected updateSessionId(response: AxiosResponse) {
        // skip if no cookie header is present
        if (!response.headers["set-cookie"]) {
            return;
        }

        // parse session id cookie
        const s = CookieParser.parse(response.headers["set-cookie"], { decodeValues: false })
            .find(c => c.name == "sharelatex.sid")?.value;

        // if a session was attached, update the current one
        if (s) {
            this.session = s;
        }
    }

    /**
     * ensure that the client has a valid session
     */
    protected requireSession() {
        if (!this.session) {
            throw new Error("session was not logged in");
        }
    }
}
