export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must include at least one lowercase letter, one uppercase letter, one number, and one symbol.";

const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    ![...password].some((character) => PASSWORD_SYMBOLS.includes(character))
  ) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  if (password !== confirmation) {
    return "Passwords do not match.";
  }

  return null;
}
