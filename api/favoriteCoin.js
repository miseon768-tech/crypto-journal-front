const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/assets/favorites`;

// resolve token (supports string or object like { accessToken, token, value } )
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

// add favorite (server expects raw string body) — tries text/plain then JSON fallback
export const addFavoriteCoin = async (coinInput, token) => {
    const t = resolveToken(token);
    if (!t) throw new Error("토큰이 필요합니다.");

    let marketStr;
    if (!coinInput) throw new Error("빈 입력입니다.");
    if (typeof coinInput === "string") marketStr = coinInput;
    else if (typeof coinInput === "object") marketStr = (coinInput.market ?? coinInput.symbol ?? "").toString() || JSON.stringify(coinInput);
    else marketStr = String(coinInput);

    marketStr = marketStr.trim().toUpperCase();

    // Try POST with text/plain (server controller expects raw String)
    const headers = authHeader(token, "text/plain");
    console.debug("[API] addFavoriteCoin - POST", API_BASE, { headers, body: marketStr });
    const res = await fetch(API_BASE, {
        method: "POST",
        headers,
        body: marketStr,
    });

    // If server rejects text/plain (415) or returns 400, try JSON fallback
    if (res.status === 415 || res.status === 400) {
        console.debug("[API] addFavoriteCoin - retrying as JSON");
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
    console.debug("[API] addFavoriteCoin - resp", res.status, body);
    if (!res.ok) {
        const err = new Error(`관심 코인 추가 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
};

// get favorites (tolerant parsing)
export const getFavoriteCoins = async (token) => {
    const t = resolveToken(token);
    if (!t) {
        console.warn("토큰 없음: 관심 코인 조회 불가");
        return [];
    }
    const res = await fetch(API_BASE, {
        method: "GET",
        headers: { Authorization: `Bearer ${t}` },
    });

    const body = await parseResponseBody(res);
    console.debug("[API] getFavoriteCoins -", res.status, body);

    // treat 404 as empty list (server may use 404 when none)
    if (res.status === 404) return [];

    if (!res.ok) {
        const err = new Error(`관심 코인 조회 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }

    // try various shapes
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.favoriteCoinList)) return body.favoriteCoinList;
    if (body && Array.isArray(body.items)) return body.items;
    if (body && Array.isArray(body.data?.favoriteCoinList)) return body.data.favoriteCoinList;
    // if object representing single favorite
    if (body && (body.market || body.id || body.tradingPair)) return [body];

    // fallback: find first array in values
    const maybe = Object.values(body || {}).find((v) => Array.isArray(v));
    return Array.isArray(maybe) ? maybe : [];
};

// delete selected
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
    console.debug("[API] deleteFavoriteCoin -", res.status, body);

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
    console.debug("[API] deleteAllFavoriteCoins -", res.status, body);

    if (!res.ok) {
        const err = new Error(`전체 삭제 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
};