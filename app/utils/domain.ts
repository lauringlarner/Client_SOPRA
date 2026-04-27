import process from "process";
import { isProduction } from "@/utils/environment";

const LOCAL_API_URL = "http://localhost:8080";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
/**
 * Returns the API base URL based on the current environment.
 * In production it retrieves the URL from NEXT_PUBLIC_PROD_API_URL (or falls back to a hardcoded url).
 * In development, it returns "http://localhost:8080".
 */
export function getApiDomain(): string {
  if (typeof window !== "undefined" && LOCAL_HOSTNAMES.has(window.location.hostname)) {
    return process.env.NEXT_PUBLIC_LOCAL_API_URL || LOCAL_API_URL;
  }

  const prodUrl = process.env.NEXT_PUBLIC_PROD_API_URL ||
    "https://sopra-fs26-group-18-server.oa.r.appspot.com/"; // TODO: update with your production URL as needed.
  const devUrl = LOCAL_API_URL;
  return isProduction() ? prodUrl : devUrl;
}
