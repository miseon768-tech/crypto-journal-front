const redirectEnvByProvider = {
    google: "NEXT_PUBLIC_GOOGLE_REDIRECT_URI",
    naver: "NEXT_PUBLIC_NAVER_REDIRECT_URI",
    kakao: "NEXT_PUBLIC_KAKAO_REDIRECT_URI",
};

function trimTrailingSlash(value) {
    return (value || "").replace(/\/+$/, "");
}

export function resolveAppBaseUrl() {
    const envBaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL || "");
    if (envBaseUrl) return envBaseUrl;

    if (typeof window !== "undefined" && window.location?.origin) {
        return trimTrailingSlash(window.location.origin);
    }

    return "";
}

export function resolveSocialRedirectUri(provider) {
    const envKey = redirectEnvByProvider[provider];
    const explicitRedirectUri = trimTrailingSlash(envKey ? process.env[envKey] || "" : "");
    if (explicitRedirectUri) return explicitRedirectUri;

    const baseUrl = resolveAppBaseUrl();
    return baseUrl ? `${baseUrl}/${provider}/callback` : `/${provider}/callback`;
}
