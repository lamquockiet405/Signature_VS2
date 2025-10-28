import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export default getRequestConfig(async () => {
  // Use headers to get locale (Next.js 15 compatible)
  const headersList = await headers();
  const locale = headersList.get("X-NEXT-INTL-LOCALE") || "vi";

  return {
    locale,
    messages: (await import(`../../locales/${locale}/common.json`)).default,
  };
});
