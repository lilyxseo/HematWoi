export type PasswordValidationResult = {
  length: boolean;
  letter: boolean;
  number: boolean;
};

export type PasswordStrength = 'weak' | 'good' | 'strong';

export function validatePassword(password: string): PasswordValidationResult {
  const value = password ?? '';
  return {
    length: value.length >= 8,
    letter: /[A-Za-z]/.test(value),
    number: /\d/.test(value),
  };
}

export function isPasswordValid(result: PasswordValidationResult): boolean {
  return result.length && result.letter && result.number;
}

export function getPasswordStrength(result: PasswordValidationResult): PasswordStrength {
  const score = Number(result.length) + Number(result.letter) + Number(result.number);
  if (score >= 3) return 'strong';
  if (score === 2) return 'good';
  return 'weak';
}
