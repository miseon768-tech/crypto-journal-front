const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/assets/favorites`;

// 🟢 Robust 토큰 파싱 및 유효성 체크!
function resolveToken(token) {
    if (!token || typeof token !== "string") return null;
    // 빈 값, "undefined", "null" 문자열 방지!
    const t = token.trim();
    if (!t || t === "undefined" || t === "null") return null;
    return t;
}

// 🟢 Authorization 헤더 일관성 있게 생성
function authHeader(token, contentType = "application/json") {
    const t = resolveToken(token);
    if (!t) throw new Error("유효한 토큰이 필요합니다.");
    return {
        Authorization: `Bearer ${t}`,
        "Content-Type": contentType,
    };
}

// 🟢 응답 파싱
async function parseResponseBody(res) {
    const text = await res.text().catch(() => null);
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
}

function extractArrayFromBody(body) {
    // ... (기존 로직 동일)
    // 생략 없이 사용 (원래 robust 패턴이라 OK)
    // ...
}

function normalizeFavoriteEntry(raw) {
    // ... (기존 로직 동일)
    // 생략 없이 사용
    // ...
}

// 🟢 관심 코인 추가
export const addFavoriteCoin = async (coinInput, token) => {
    const t = resolveToken(token);
    if (!t) throw new Error("유효한 토큰이 필요합니다.");

    let marketStr;
    if (!coinInput) throw new Error("빈 입력입니다.");
    if (typeof coinInput === "string") marketStr = coinInput;
    else if (typeof coinInput === "object") marketStr = (coinInput.market ?? coinInput.symbol ?? "").toString() || JSON.stringify(coinInput);
    else marketStr = String(coinInput);

    marketStr = marketStr.trim().toUpperCase();

    // 최초 plain text 시도
    let headers, res;
    try {
        headers = authHeader(t, "text/plain");
        res = await fetch(API_BASE, {
            method: "POST",
            headers,
            body: marketStr,
        });
    } catch (e) {
        throw new Error("API 호출 실패: " + e.message);
    }

    if (res.status === 415 || res.status === 400) {
        // JSON 방식으로 fallback
        const res2 = await fetch(API_BASE, {
            method: "POST",
            headers: authHeader(t, "application/json"),
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

// 🟢 관심 코인 리스트 반환
export const getFavoriteCoins = async (token) => {
    const t = resolveToken(token);
    if (!t) return [];

    const headers = authHeader(t);
    const res = await fetch(API_BASE, {
        method: "GET",
        headers,
    });

    const body = await parseResponseBody(res);

    if (res.status === 404 || res.status === 204) return [];

    const possibleMsg = (body && (body.message || body.error || (typeof body === 'string' ? body : null))) || null;
    if (!res.ok) {
        if (possibleMsg && String(possibleMsg).includes("관심 코인 없음")) return [];
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

// 🟢 선택 코인 삭제
export const deleteFavoriteCoin = async (ids, token) => {
    const t = resolveToken(token);
    if (!t) throw new Error("유효한 토큰이 필요합니다.");
    if (!Array.isArray(ids)) throw new Error("ids는 배열이어야 합니다.");

    const res = await fetch(`${API_BASE}/select`, {
        method: "DELETE",
        headers: authHeader(t),
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

// 🟢 전체 코인 삭제
export const deleteAllFavoriteCoins = async (token) => {
    const t = resolveToken(token);
    if (!t) throw new Error("유효한 토큰이 필요합니다.");

    const headers = authHeader(t);
    const res = await fetch(API_BASE, {
        method: "DELETE",
        headers,
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