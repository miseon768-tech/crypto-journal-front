const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://3.36.109.46.nip.io:8080"}/api/assets/favorites`;

import { getStoredToken } from './member';

// 🟢 Robust 토큰 파싱 및 유효성 체크!
function resolveToken(token) {
    // 우선 간단한 문자열 검사
    if (token && typeof token === 'string') {
        const t = token.trim();
        if (!t || t === 'undefined' || t === 'null') return null;
        return t;
    }

    // token이 객체나 다른 형태로 들어왔을 때 member.getStoredToken을 사용해 정상 토큰 문자열을 추출
    try {
        const extracted = getStoredToken(token);
        if (extracted && typeof extracted === 'string') {
            const s = extracted.trim();
            if (!s || s === 'undefined' || s === 'null') return null;
            return s;
        }
    } catch (e) {
        // 무시하고 null 반환
    }

    return null;
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

// 다양한 백 응답에서 배열을 추출하는 헬퍼
function extractArrayFromBody(body) {
    if (!body) return null;
    if (Array.isArray(body)) return body;

    // common wrappers
    const candidates = [
        body.favoriteCoinList,
        body.favorite_coin_list,
        body.favorite_list,
        body.items,
        body.data?.favoriteCoinList,
        body.data?.items,
        body.data?.favorite_list,
        body.data?.items,
    ];

    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }

    // sometimes backend returns { favoriteCoin: {...} }
    if (body.favoriteCoin && typeof body.favoriteCoin === 'object') return [body.favoriteCoin];
    if (body.favorite_coin && typeof body.favorite_coin === 'object') return [body.favorite_coin];

    // sometimes backend returns { data: {...} }
    if (body.data && typeof body.data === 'object') {
        const arr = extractArrayFromBody(body.data);
        if (Array.isArray(arr)) return arr;
        // or single entry in data
        if (body.data.favoriteCoin && typeof body.data.favoriteCoin === 'object') return [body.data.favoriteCoin];
    }

    // lastly, if object looks like a single favorite entry, return it
    const maybeObj = body;
    if (typeof maybeObj === 'object') {
        const keys = Object.keys(maybeObj);
        const hasKey = keys.some(k => ['market','tradingPairId','trading_pair_id','id','favoriteId','coin'].includes(k));
        if (hasKey) return [maybeObj];
    }

    return null;
}

// 엔트리를 일관된 형태로 정규화 (최소 필드: id, market, tradingPairId, raw)
function normalizeFavoriteEntry(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const out = { raw };

    // id candidates
    out.id = raw.id ?? raw._id ?? raw.favoriteId ?? raw.favorite_id ?? null;

    // trading pair id
    out.tradingPairId = raw.tradingPairId ?? raw.trading_pair_id ?? raw.trading_pair ?? raw.tpId ?? raw.tradingPair ?? null;

    // market symbol
    out.market = raw.market ?? raw.code ?? raw.symbol ?? raw.marketName ?? raw.market_name ?? null;

    // extra friendly names
    out.korean_name = raw.korean_name ?? raw.koreanName ?? raw.name ?? raw.korean ?? null;
    out.english_name = raw.english_name ?? raw.englishName ?? null;

    // tradingPair object extraction
    if (!out.market && raw.tradingPair && typeof raw.tradingPair === 'object') {
        out.market = raw.tradingPair.market ?? raw.tradingPair.symbol ?? raw.tradingPair.code ?? out.market;
        out.korean_name = out.korean_name || raw.tradingPair.korean_name || raw.tradingPair.koreanName || null;
        out.english_name = out.english_name || raw.tradingPair.english_name || raw.tradingPair.englishName || null;
    }

    // normalize market format: e.g., BTC -> KRW-BTC if needed left for UI
    if (typeof out.market === 'string') {
        let s = out.market.trim();
        if (s && !s.includes('-')) {
            // do not force-prefix, keep as-is; UI can normalize later
            out.market = s.toUpperCase();
        } else if (s) out.market = s.toUpperCase();
    }

    return out;
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
    if (!t) {
        console.debug('[api/favoriteCoin] getFavoriteCoins - no token resolved', { incoming: token });
        return [];
    }

    const headers = authHeader(t);
    const res = await fetch(API_BASE, {
        method: "GET",
        headers,
    });

    const body = await parseResponseBody(res);

    if (!res.ok) {
        console.error('[api/favoriteCoin] getFavoriteCoins non-ok response', { status: res.status, body });
    }

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

    return arr.map(normalizeFavoriteEntry);
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