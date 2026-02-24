// 안전한 토큰 저장/복원용 간단 스토어
// - 토큰은 항상 문자열로만 저장/전달되도록 정규화
// - getStoredToken 재사용하여 [object Object] 같은 입력을 처리

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
    // Lazy initialize from localStorage
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
        try { const raw = localStorage.getItem('token'); if (raw) _token = String(raw); } catch (e) {}
    }

    const setToken = (t) => {
        // normalize using shared helper - ensures token is plain string (extract from object if necessary)
        let normalized = null;
        try { normalized = getStoredToken(t) || (t != null ? String(t) : null); } catch (e) { try { normalized = t != null ? String(t) : null; } catch (ee) { normalized = null; } }

        _token = normalized;
        try { if (normalized) localStorage.setItem('token', String(normalized)); else localStorage.removeItem('token'); } catch (e) {}
        emit();
    };

    const clearToken = () => setToken(null);
    const getToken = () => _token;

    return { token: _token, setToken, clearToken, getToken };
}
