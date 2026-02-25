import { getStoredToken } from "../api/member";

/* ---------- Helpers ---------- */
function isFalsyString(s) {
    if (s == null) return true;
    if (typeof s !== "string") return false;
    const t = s.trim().toLowerCase();
    return t === "" || t === "null" || t === "undefined";
}

/* ---------- Simple in-memory store (fallback) ---------- */
let _account = null;
let _token = null;
const listeners = new Set();
function emit() { listeners.forEach(cb => { try { cb(); } catch (e) {} }); }

export function useAccount() {
    if (typeof window !== 'undefined' && _account === null) {
        try { const raw = localStorage.getItem('account'); if (raw) _account = JSON.parse(raw); } catch (e) {}
    }

    const setAccount = (a) => {
        _account = a;
        try { if (a) localStorage.setItem('account', JSON.stringify(a)); else localStorage.removeItem('account'); } catch (e) {}
        emit();
    };

    const clearAccount = () => setAccount(null);
    const getAccount = () => _account;

    return { account: _account, setAccount, clearAccount, getAccount };
}

export function useToken() {
    if (typeof window !== 'undefined' && _token === null) {
        try {
            const raw = localStorage.getItem('token');
            if (raw && !isFalsyString(raw)) _token = String(raw).trim();
        } catch (e) {}
    }

    const setToken = (t) => {
        // 반드시 "정상 JWT"만 저장, 나머지는 삭제
        let normalized = null;
        try {
            normalized = getStoredToken(t);
        } catch (e) {
            normalized = null;
        }

        // 정상 토큰 패턴이 아니면 저장 안 함
        const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+\/=]*$/;
        if (!normalized || !jwtRegex.test(normalized.trim())) {
            _token = null;
            try { localStorage.removeItem('token'); } catch (e) {}
            emit();
            return;
        }
        _token = normalized.trim();
        try { localStorage.setItem('token', _token); } catch (e) {}
        emit();
    };

    const clearToken = () => setToken(null);
    const getToken = () => _token;

    return { token: _token, setToken, clearToken, getToken };
}