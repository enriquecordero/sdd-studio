const SPEC_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 64;

export function isValidSpecName(name: string): boolean {
  return name.length <= MAX_LENGTH && SPEC_NAME_RE.test(name);
}

export function toSpecName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '');
}
