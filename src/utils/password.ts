export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un caractere special (@$!%*?&-#).';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-#])[A-Za-z\d@$!%*?&\-#]{8,}$/;

export function isStrongPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password);
}

export function getPasswordValidationMessage(password: string): string | null {
  return isStrongPassword(password) ? null : PASSWORD_REQUIREMENTS_MESSAGE;
}
