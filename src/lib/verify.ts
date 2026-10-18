/** Email domains anyone can sign up for. A match on these proves nothing. */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com',
  'yandex.com', 'comcast.net', 'verizon.net', 'cox.net', 'att.net', 'sbcglobal.net', 'fastmail.com', 'hey.com',
]);

/** Website hosts shared by many businesses (social profiles, site builders). Their domain does not identify one owner. */
const SHARED_HOSTS = [
  'facebook.com', 'instagram.com', 'google.com', 'business.site', 'wixsite.com', 'square.site', 'squarespace.com',
  'godaddysites.com', 'weebly.com', 'wordpress.com', 'yelp.com', 'linktr.ee', 'tripadvisor.com', 'blogspot.com',
];

export function websiteHost(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

const isUnder = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * The first email whose domain is the listing website's domain (or a parent of it), or null.
 * joe@harborlight.com matches harborlight.com and shop.harborlight.com; free-mail and shared hosts never match.
 */
export function matchingEmail(emails: string[], website: string | null | undefined): string | null {
  const host = websiteHost(website);
  if (!host || SHARED_HOSTS.some((d) => isUnder(host, d))) return null;
  for (const email of emails) {
    const domain = email.toLowerCase().split('@')[1];
    if (!domain || FREE_MAIL.has(domain)) continue;
    if (isUnder(host, domain)) return email;
  }
  return null;
}
