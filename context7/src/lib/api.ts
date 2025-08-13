import { SearchResponse } from "./types.js";
import { generateHeaders } from "./encryption.js";

const CONTEXT7_API_BASE_URL = "https://context7.com/api";
const DEFAULT_TYPE = "txt";

/**
 * Searches for libraries matching the given query
 * @param query The search query
 * @param clientIp Optional client IP address to include in headers
 * @returns Search results or null if the request fails
 */
export async function searchLibraries(query: string, clientIp?: string): Promise<SearchResponse> {
  try {
    const url = new URL(`${CONTEXT7_API_BASE_URL}/v1/search`);
    url.searchParams.set("query", query);

    const headers = generateHeaders(clientIp);

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const errorCode = response.status;
      if (errorCode === 429) {
        console.error(`Rate limited due to too many requests. Please try again later.`);
        return {
          results: [],
          error: `Rate limited due to too many requests. Please try again later.`,
        } as SearchResponse;
      }
      console.error(`Failed to search libraries. Please try again later. Error code: ${errorCode}`);
      return {
        results: [],
        error: `Failed to search libraries. Please try again later. Error code: ${errorCode}`,
      } as SearchResponse;
    }
    return await response.json();
  } catch (error) {
    console.error("Error searching libraries:", error);
    return { results: [], error: `Error searching libraries: ${error}` } as SearchResponse;
  }
}

/**
 * Fetches documentation context for a specific library
 * @param libraryId The library ID to fetch documentation for
 * @param options Options for the request
 * @param clientIp Optional client IP address to include in headers
 * @returns The documentation text or null if the request fails
 */
export async function fetchLibraryDocumentation(
  libraryId: string,
  options: {
    tokens?: number;
    topic?: string;
  } = {},
  clientIp?: string
): Promise<string | null> {
  try {
    if (libraryId.startsWith("/")) {
      libraryId = libraryId.slice(1);
    }
    const url = new URL(`${CONTEXT7_API_BASE_URL}/v1/${libraryId}`);
    if (options.tokens) url.searchParams.set("tokens", options.tokens.toString());
    if (options.topic) url.searchParams.set("topic", options.topic);
    url.searchParams.set("type", DEFAULT_TYPE);

    const headers = generateHeaders(clientIp, { "X-Context7-Source": "mcp-server" });

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const errorCode = response.status;
      if (errorCode === 429) {
        const errorMessage = `Rate limited due to too many requests. Please try again later.`;
        console.error(errorMessage);
        return errorMessage;
      }
      const errorMessage = `Failed to fetch documentation. Please try again later. Error code: ${errorCode}`;
      console.error(errorMessage);
      return errorMessage;
    }
    const text = await response.text();
    if (!text || text === "No content available" || text === "No context data available") {
      return null;
    }
    return text;
  } catch (error) {
    const errorMessage = `Error fetching library documentation. Please try again later. ${error}`;
    console.error(errorMessage);
    return errorMessage;
  }
}
