export interface ApplicationError extends Error {
  info: string;
  reason?: string;
  status: number;
  statusText?: string;
}
