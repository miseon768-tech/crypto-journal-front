import { useEffect, useState } from 'react';

// 간단한 전역 상태 저장소 (브라우저 단일 페이지용)
let _account = null;
let _token = null;

const accountSubs = new Set();
const tokenSubs = new Set();

export function setAccountGlobal(a) {
  _account = a;
  accountSubs.forEach((cb) => cb(_account));
}

export function setTokenGlobal(t) {
  _token = t;
  tokenSubs.forEach((cb) => cb(_token));
}

export function useAccount() {
  const [account, setAccountLocal] = useState(_account);

  useEffect(() => {
    const cb = (v) => setAccountLocal(v);
    accountSubs.add(cb);
    // 초기 동기화
    setAccountLocal(_account);
    return () => accountSubs.delete(cb);
  }, []);

  return {
    account,
    setAccount: setAccountGlobal,
  };
}

export function useToken() {
  const [token, setTokenLocal] = useState(_token);

  useEffect(() => {
    const cb = (v) => setTokenLocal(v);
    tokenSubs.add(cb);
    setTokenLocal(_token);
    return () => tokenSubs.delete(cb);
  }, []);

  return {
    token,
    setToken: setTokenGlobal,
  };
}

