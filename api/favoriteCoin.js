// API client for favorite coins (robust parsing + normalization)
const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/assets/favorites`;

function resolveToken(token) {
    if (!token) return null;
    if (typeof token === "string") return token;
    return token.accessToken ?? token.token ?? token.value ?? null;
}

function authHeader(token, contentType = "application/json") {
    const t = resolveToken(token);
    if (!t) return {};
    return {
        Authorization: `Bearer ${t}`,
        "Content-Type": contentType,
    };
}

async function parseResponseBody(res) {
    const text = await res.text().catch(() => null);
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
}

function extractArrayFromBody(body) {
    if (!body) return null;
    if (Array.isArray(body)) return body;

    const candidates = [
        "favorite_coin_list",
        "favoriteCoinList",
        "favorite_coin",
        "items",
        "data",
        "favorites",
        "favoriteList",
        "list",
    ];

    for (const key of candidates) {
        const v = body[key];
        if (Array.isArray(v)) return v;
        if (v && typeof v === "object") {
            for (const subKey of ["favorite_coin_list", "favoriteCoinList", "items", "favorites"]) {
                if (Array.isArray(v[subKey])) return v[subKey];
            }
        }
    }

    const maybe = Object.values(body).find((v) => Array.isArray(v));
    if (Array.isArray(maybe)) return maybe;

    return null;
}

function normalizeFavoriteEntry(raw) {
    if (!raw || typeof raw !== "object") return raw;

    const tradingPair = raw.tradingPair ?? raw.trading_pair ?? raw.trading_pair_obj ?? raw.tp ?? null;

    const tradingPairId =
        raw.tradingPairId ??
        raw.trading_pair_id ??
        tradingPair?.id ??
        tradingPair?._id ??
        raw.id ??
        null;

    const market =
        raw.market ??
        raw.marketName ??
        raw.market_name ??
        tradingPair?.market ??
        tradingPair?.code ??
        tradingPair?.symbol ??
        "";

    const korean_name =
        raw.korean_name ??
        raw.koreanName ??
        tradingPair?.korean_name ??
        tradingPair?.koreanName ??
        raw.name ??
        raw.title ??
        "";

    const createdAt = raw.createdAt ?? raw.created_at ?? raw.created ?? null;

    const id = raw.id ?? raw._id ?? (tradingPairId != null ? String(tradingPairId) : market || null);

    return {
        id,
        tradingPairId: tradingPairId != null ? Number(tradingPairId) : null,
        market: market || null,
        korean_name: korean_name || null,
        createdAt,
        raw,
    };
}

export const addFavoriteCoin = async (coinInput, token) => {
    const t = resolveToken(token);
    if (!t) throw new Error("토큰이 필요합니다.");

    let marketStr;
    if (!coinInput) throw new Error("빈 입력입니다.");
    if (typeof coinInput === "string") marketStr = coinInput;
    else if (typeof coinInput === "object") marketStr = (coinInput.market ?? coinInput.symbol ?? "").toString() || JSON.stringify(coinInput);
    else marketStr = String(coinInput);

    marketStr = marketStr.trim().toUpperCase();

    const headers = authHeader(token, "text/plain");
    const res = await fetch(API_BASE, {
        method: "POST",
        headers,
        body: marketStr,
    });

    if (res.status === 415 || res.status === 400) {
        const res2 = await fetch(API_BASE, {
            method: "POST",
            headers: authHeader(token, "application/json"),
            body: JSON.stringify({ market: marketStr }),
        });
        const parsed2 = await parseResponseBody(res2);
        if (!res2.ok) {
            const err = new Error(`관심 코인 추가 실패 (status: ${res2.status})${parsed2 ? " - " + JSON.stringify(parsed2) : ""}`);
            err.status = res2.status;
            err.body = parsed2;
            throw err;
        }
        return parsed2;
    }

    const body = await parseResponseBody(res);
    if (!res.ok) {
        const err = new Error(`관심 코인 추가 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
};

export const getFavoriteCoins = async (token) => {
    const t = resolveToken(token);
    if (!t) return [];

    const res = await fetch(API_BASE, {
        method: "GET",
        headers: { Authorization: `Bearer ${t}` },
    });

    const body = await parseResponseBody(res);

    // Accept: 204 / 404 as empty list
    if (res.status === 404 || res.status === 204) return [];

    // If server returned an error message that means "no favorites", treat as empty instead of throwing
    const possibleMsg = (body && (body.message || body.error || (typeof body === 'string' ? body : null))) || null;
    if (!res.ok) {
        if (possibleMsg && String(possibleMsg).includes("관심 코인 없음")) return [];
        // some servers may return 500 with a NoSuchElementException message
        if (res.status >= 500 && possibleMsg && /NoSuchElement|관심 코인 없음/i.test(String(possibleMsg))) return [];

        const err = new Error(`관심 코인 조회 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }

    let arr = extractArrayFromBody(body);

    if (!arr) {
        if (body?.favoriteCoin && typeof body.favoriteCoin === "object") arr = [body.favoriteCoin];
        else if (body?.favorite_coin && typeof body.favorite_coin === "object") arr = [body.favorite_coin];
        else if (body && (body.market || body.id || body.tradingPair || body.trading_pair || body.trading_pair_id || body.tradingPairId)) {
            arr = [body];
        }
    }

    if (!arr) arr = [];

    const normalized = arr.map(normalizeFavoriteEntry);
    return normalized;
};

export const deleteFavoriteCoin = async (ids, token) => {
    const t = resolveToken(token);
    if (!t) throw new Error("토큰이 필요합니다.");
    if (!Array.isArray(ids)) throw new Error("ids는 배열이어야 합니다.");

    const res = await fetch(`${API_BASE}/select`, {
        method: "DELETE",
        headers: authHeader(token, "application/json"),
        body: JSON.stringify(ids),
    });

    const body = await parseResponseBody(res);

    if (!res.ok) {
        const err = new Error(`선택 삭제 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
};

export const deleteAllFavoriteCoins = async (token) => {
    const t = resolveToken(token);
    if (!t) throw new Error("토큰이 필요합니다.");

    const res = await fetch(API_BASE, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
    });

    const body = await parseResponseBody(res);

    if (!res.ok) {
        const err = new Error(`전체 삭제 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
};