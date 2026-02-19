import { create } from "zustand";
import { persist } from "zustand/middleware";

function extractTokenFromObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    // 흔히 쓰이는 필드 우선 추출
    if (obj.token) return String(obj.token).trim();
    if (obj.accessToken) return String(obj.accessToken).trim();
    if (obj.access_token) return String(obj.access_token).trim();
    if (obj.value) return String(obj.value).trim();

    // 자주 있는 래퍼 필드
    if (obj.state && typeof obj.state === 'object') {
        const t = extractTokenFromObject(obj.state);
        if (t) return t;
    }
    if (obj.data && typeof obj.data === 'object') {
        const t = extractTokenFromObject(obj.data);
        if (t) return t;
    }
    if (obj.payload && typeof obj.payload === 'object') {
        const t = extractTokenFromObject(obj.payload);
        if (t) return t;
    }

    // 마지막으로, 문자열 속성 중 JWT 형식(헤더.페이로드.서명)을 만족하는 값이 있으면 반환
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+\/=]*$/;
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string') {
            const s = v.trim();
            if (jwtRegex.test(s)) return s;
        }
    }

    return null;
}

function normalizeTokenInput(newToken) {
    if (!newToken) return null;
    if (typeof newToken === "string") {
        const t = newToken.trim();
        if (!t) return null;
        // 문자열이 JSON 직렬화된 상태라면 파싱 시도
        if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('"{') && t.endsWith('}"'))) {
            try {
                const parsed = JSON.parse(t);
                const inner = extractTokenFromObject(parsed);
                if (inner) return inner;
            } catch (e) {
                // ignore
            }
        }
        // 문자열 자체가 JWT 형식이면 반환
        const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+\/=]*$/;
        if (jwtRegex.test(t)) return t;
        return t;
    }
    if (typeof newToken === "object") {
        const inner = extractTokenFromObject(newToken);
        if (inner) return inner;
        try {
            const s = JSON.stringify(newToken);
            return s && s !== "{}" ? s.trim() : null;
        } catch (e) {
            return null;
        }
    }
    try { return String(newToken).trim(); } catch (e) { return null; }
}

export const useAccount = create(
    persist(
        (set) => ({
            account: null,
            setAccount: (newAccount) => set({ account: newAccount }),
            clearAccount: () => set({ account: null }),
        }),
        { name: "account" }
    )
);

export const useToken = create(
    persist(
        (set, get) => ({
            token: null,
            setToken: (newToken) => {
                // 항상 정규화된 문자열을 상태와 localStorage에 저장
                const normalized = normalizeTokenInput(newToken);
                set({ token: normalized });
                try {
                    if (typeof window !== 'undefined') {
                        if (!normalized) localStorage.removeItem('token');
                        else localStorage.setItem('token', normalized);
                    }
                } catch (e) {
                    // ignore storage errors
                }
            },
            clearToken: () => {
                set({ token: null });
                try { if (typeof window !== 'undefined') localStorage.removeItem('token'); } catch (e) {}
            },
        }),
        {
            name: "token",
            // rehydrate 시 저장된 값이 객체일 경우 자동 정규화
            onRehydrateStorage: () => (state) => {
                try {
                    if (state && state.token) {
                        const normalized = normalizeTokenInput(state.token);
                        if (normalized && normalized !== state.token) {
                            state.token = normalized;
                            try { if (typeof window !== 'undefined') localStorage.setItem('token', normalized); } catch (e) {}
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    )
);
