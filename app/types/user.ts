export interface User {
  id: number | string;
  username: string;
  status: string;
  creation_date: string;
  bio: string;
  // Optional legacy field from milestone template.
  name?: string;
}

export interface AuthUser extends User {
  token: string;
}
