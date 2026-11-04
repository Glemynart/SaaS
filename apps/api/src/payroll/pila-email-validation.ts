export function isValidPilaEmail(value: string): boolean {
  const separator = value.indexOf('@');
  if (separator <= 0 || separator !== value.lastIndexOf('@')) return false;
  const username = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return (
    /^[a-z0-9._'-]+$/.test(username) &&
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(domain)
  );
}
