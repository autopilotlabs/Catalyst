export interface AuthContextData {
  userId: string;
  workspaceId: string;
  membership: {
    role: 'owner' | 'admin' | 'member' | 'viewer';
  };
  isApiKey?: boolean;
}
