type SignUpData = {
  user: {
    identities?: unknown[];
  } | null;
};

type SignUpError = {
  code?: string;
  message: string;
} | null;

export const EXISTING_ACCOUNT_MESSAGE =
  'That email is already connected to an existing account. Please sign in instead.';

export function isExistingAccountSignUp(data: SignUpData, error: SignUpError) {
  if (
    error?.code === 'user_already_exists' ||
    error?.message.toLowerCase().includes('already registered')
  ) {
    return true;
  }

  return Array.isArray(data.user?.identities) && data.user.identities.length === 0;
}
