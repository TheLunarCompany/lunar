export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
};

export type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
};

export type AuthContextValue = AuthState & {
  loginRequired: boolean;
  login: (redirectUri?: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};
