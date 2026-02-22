const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/assets/favorites`;

// plain text header (POST expects raw string)
const authHeaderPlain = (token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "text/plain",
});

// json header
const authHeaderJson = (token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
});

// 유틸: 응답 본문 안전 파싱
async function parseResponseBody(res) {
    const text = await res.text().catch(() => null);
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
}

// 관심 코인 추가 (서버가 RequestBody로 원시 문자열을 받도록 구현됨)
export const addFavoriteCoin = async (coinInput, token) => {
    if (!token) throw new Error("토큰이 필요합니다.");

    let marketStr;
    if (!coinInput) throw new Error("빈 입력입니다.");
    if (typeof coinInput === "string") marketStr = coinInput;
    else if (typeof coinInput === "object") marketStr = (coinInput.market ?? coinInput.symbol ?? "").toString() || JSON.stringify(coinInput);
    else marketStr = String(coinInput);

    marketStr = marketStr.trim().toUpperCase();

    const res = await fetch(API_BASE, {
        method: "POST",
        headers: authHeaderPlain(token),
        body: marketStr,
    });

    const body = await parseResponseBody(res);
    if (!res.ok) {
        const err = new Error(`관심 코인 추가 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
};

// 관심 코인 조회 — 404("관심 코인 없음")인 경우 빈 배열 반환하도록 처리
export const getFavoriteCoins = async (token) => {
    if (!token) {
        console.warn("토큰 없음: 관심 코인 조회 불가");
        return [];
    }
    const res = await fetch(API_BASE, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
    });

    const body = await parseResponseBody(res);

    // 서버가 관심 코인이 없을 때 404 + { message: "관심 코인 없음" } 반환하는 경우,
    // 이를 에러가 아닌 빈 리스트로 처리합니다.
    if (res.status === 404) {
        console.debug("getFavoriteCoins: 404 from server, treating as empty list", body);
        return [];
    }

    if (!res.ok) {
        const err = new Error(`관심 코인 조회 실패 (status: ${res.status})${body ? " - " + JSON.stringify(body) : ""}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }

    // 컨트롤러가 GetFavoriteCoinsResponse 형태로 반환할 수 있으므로 안전하게 리스트 추출
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.favoriteCoinList)) return body.favoriteCoinList;
    return [];
};

// 선택 삭제 (body: [id1, id2, ...])
export const deleteFavoriteCoin = async (ids, token) => {
    if (!token) throw new Error("토큰이 필요합니다.");
    if (!Array.isArray(ids)) throw new Error("ids는 배열이어야 합니다.");

    const res = await fetch(`${API_BASE}/select`, {
        method: "DELETE",
        headers: authHeaderJson(token),
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

// 전체 삭제
export const deleteAllFavoriteCoins = async (token) => {
    if (!token) throw new Error("토큰이 필요합니다.");

    const res = await fetch(API_BASE, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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