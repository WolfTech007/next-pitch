/** Cookie + request-header names for demo slate / fake wallet (shared server + client). */

export const NP_DEMO_MODE_COOKIE = "np_demo_mode";
export const NP_DEMO_DATE_COOKIE = "np_demo_date";

/**
 * Browser sends these on fetch so Route Handlers agree with `document.cookie` when the
 * Cookie header is missing or not exposed to `cookies()` on Vercel.
 */
export const NP_DEMO_MODE_HEADER = "x-np-demo-mode";
export const NP_DEMO_DATE_HEADER = "x-np-demo-date";
export const NP_DEMO_HEADER_ON = "1";

/** GET query — cannot be stripped like cookies on some hosts. */
export const NP_DEMO_QUERY_PARAM = "np_demo";
export const NP_DEMO_QUERY_VALUE = "1";

/** sessionStorage — mirrors demo intent when cookies are flaky on some hosts. */
export const NP_DEMO_SESSION_KEY = "np_demo_active";
