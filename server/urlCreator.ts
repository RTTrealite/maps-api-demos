// Copyright (c) 2014-2019, EagleView. All rights reserved.

import { IToken } from "../shared/IToken";

export type UrlFunc = (path: string, query?: string) => string

export async function urlCreator(req, apiBaseUrl: string, clientCredentialsTokenFunc: (req: any) => Promise<IToken>): Promise<UrlFunc> {
    const token = await clientCredentialsTokenFunc(req);
    const auth = 'access_token=' + token.access_token;

    // Return a function that will take in a path and optional query string, and will append the base url and auth params
    return (path: string, query?: string) => {
        query = query ? `&${query}` : '';
        return `${apiBaseUrl}${path}?${auth}${query}`;
    }
}