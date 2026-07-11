/**
 * SillyTavern macro substitution — cards use {{char}} and {{user}} throughout
 * descriptions, greetings, and example dialogue. Applied wherever card text
 * is displayed or spoken in TomeForge.
 */
export function applyMacros(text: string, charName: string, userName = 'you'): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName)
}
