export const httpClient = {
    get: async (url: string): Promise<any> => {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`${response.status} ${response.statusText}`);
        } else {
            return await response.json()
        }
    }
}