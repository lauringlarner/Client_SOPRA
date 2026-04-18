import { getApiDomain } from "@/utils/domain";
import { ApplicationError } from "@/types/error";

export class ApiService {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseURL = getApiDomain();
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  private createHeaders(token?: string, includeJsonContentType: boolean = true): HeadersInit {
    const headers: Record<string, string> = includeJsonContentType
      ? { ...this.defaultHeaders }
      : {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Helper function to check the response, parse JSON,
   * and throw an error if the response is not OK.
   *
   * @param res - The response from fetch.
   * @param errorMessage - A descriptive error message for this call.
   * @returns Parsed JSON data.
   * @throws ApplicationError if res.ok is false.
   */
  private async processResponse<T>(
    res: Response,
    errorMessage: string,
  ): Promise<T> {
    if (!res.ok) {
      let errorDetail = res.statusText;
      try {
        const errorInfo = await res.json();
        if (errorInfo?.reason) {
          errorDetail = errorInfo.reason;
        } else if (errorInfo?.message) {
          errorDetail = errorInfo.message;
        } else {
          errorDetail = JSON.stringify(errorInfo);
        }
      } catch {
        // If parsing fails, keep using res.statusText
      }
      const detailedMessage = `${errorMessage} (${res.status}: ${errorDetail})`;
      const error: ApplicationError = new Error(
        detailedMessage,
      ) as ApplicationError;
      error.info = JSON.stringify(
        { status: res.status, statusText: res.statusText },
        null,
        2,
      );
      error.status = res.status;
      throw error;
    }

    if (res.status === 204 || res.status === 205) {
      return undefined as T;
    }

    return res.headers.get("Content-Type")?.includes("application/json")
      ? (res.json() as Promise<T>)
      : Promise.resolve(res as T);
  }

  /**
   * GET request.
   * @param endpoint - The API endpoint (e.g. "/users").
   * @param token - Optional bearer token.
   * @returns JSON data of type T.
   */
  public async get<T>(endpoint: string, token?: string): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const res = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(token),
    });

    return this.processResponse<T>(
      res,
      "An error occurred while fetching the data.\n",
    );
  }

  /**
   * POST request.
   * @param endpoint - The API endpoint (e.g. "/users").
   * @param data - The payload to post.
   * @param token - Optional bearer token.
   * @returns JSON data of type T.
   */
  public async post<T>(
    endpoint: string,
    data?: unknown,
    token?: string,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const isFormData = data instanceof FormData;
    const request: RequestInit = {
      method: "POST",
      headers: this.createHeaders(token, !isFormData),
    };
    if (data !== undefined) {
      if (isFormData) {
        request.body = data;
      } else {
        request.body = JSON.stringify(data);
      }
    }
    const res = await fetch(url, request);
    return this.processResponse<T>(
      res,
      "An error occurred while posting the data.\n",
    );
  }

  /**
   * PUT request.
   * @param endpoint - The API endpoint (e.g. "/users/123").
   * @param data - The payload to update.
   * @param token - Optional bearer token.
   * @returns JSON data of type T.
   */
  public async put<T>(
    endpoint: string,
    data: unknown,
    token?: string,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: this.createHeaders(token),
      body: JSON.stringify(data),
    });
    return this.processResponse<T>(
      res,
      "An error occurred while updating the data.\n",
    );
  }

  /**
   * DELETE request.
   * @param endpoint - The API endpoint (e.g. "/users/123").
   * @param token - Optional bearer token.
   * @returns JSON data of type T.
   */
  public async delete<T>(endpoint: string, token?: string): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.createHeaders(token),
    });
    return this.processResponse<T>(
      res,
      "An error occurred while deleting the data.\n",
    );
  }
}
