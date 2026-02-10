import { create } from "zustand";
import { persist } from "zustand/middleware";

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
        (set) => ({
            token: null,
            setToken: (newToken) => set({ token: newToken }),
            clearToken: () => set({ token: null }),
        }),
        { name: "token" }
    )
);