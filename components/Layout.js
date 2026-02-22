import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
    getStoredToken,
    removeToken,
    getMyInfo,
    updateMember,
    changePassword,
    deleteMember,
} from "../api/member";

export default function Layout({ children }) {
    const router = useRouter();

    const [menuOpen, setMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("profile"); // profile | password | preferences
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // fixed dropdown position
    const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, width: 384 });

    // profile state
    const [email, setEmail] = useState("");
    const [nickname, setNickname] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [loadingProfile, setLoadingProfile] = useState(false);

    // password state
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");

    // preferences state
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [darkMode, setDarkMode] = useState(true);

    // outside click / ESC to close menu
    useEffect(() => {
        function onDocClick(e) {
            if (!menuOpen) return;
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target)
            ) {
                setMenuOpen(false);
            }
        }
        function onKey(e) {
            if (e.key === "Escape") setMenuOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    // compute dropdown position relative to button (fixed)
    useEffect(() => {
        const DROPDOWN_WIDTH = 384; // w-96
        function updatePosition() {
            const btn = buttonRef.current;
            if (!btn) return;
            const rect = btn.getBoundingClientRect();
            const scrollY = window.scrollY || window.pageYOffset || 0;
            let left = Math.round(rect.right - DROPDOWN_WIDTH - 8);
            const minLeft = 8;
            const maxLeft = window.innerWidth - DROPDOWN_WIDTH - 8;
            if (left < minLeft) left = minLeft;
            if (left > maxLeft) left = maxLeft;
            const top = Math.round(rect.bottom + scrollY + 8); // 8px gap
            setDropdownStyle({ top, left, width: DROPDOWN_WIDTH });
        }

        if (menuOpen) {
            updatePosition();
            window.addEventListener("resize", updatePosition);
            window.addEventListener("scroll", updatePosition, true);
            return () => {
                window.removeEventListener("resize", updatePosition);
                window.removeEventListener("scroll", updatePosition, true);
            };
        }
    }, [menuOpen]);

    const handleLogout = () => {
        try { removeToken(); } catch (e) {}
        setMenuOpen(false);
        router.push("/login");
    };

    // load profile when menu opens and profile tab active
    useEffect(() => {
        if (!menuOpen) return;
        if (activeTab !== "profile") return;

        let mounted = true;
        const load = async () => {
            setLoadingProfile(true);
            try {
                const token = getStoredToken();
                if (!token) {
                    // not logged in, clear fields
                    setEmail("");
                    setNickname("");
                    setDisplayName("");
                    setBio("");
                    return;
                }
                const data = await getMyInfo(token);
                // accommodate possible response shapes
                const user = data?.member ?? data?.data ?? data ?? {};
                if (!mounted) return;
                setEmail(user.email ?? "");
                setNickname(user.nickname ?? user.nick ?? "");
                setDisplayName(user.displayName ?? user.name ?? "");
                setBio(user.bio ?? user.introduce ?? "");
                // preferences if provided
                if (user.notifyEmail !== undefined) setNotifyEmail(Boolean(user.notifyEmail));
                if (user.darkMode !== undefined) setDarkMode(Boolean(user.darkMode));
            } catch (err) {
                console.error("프로필 로드 실패", err);
                // leave existing values (or clear)
            } finally {
                if (mounted) setLoadingProfile(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [menuOpen, activeTab]);

    // save profile -> call updateMember(token, data)
    const saveProfile = async (e) => {
        e.preventDefault();
        const emailTrim = (email || "").trim();
        const nicknameTrim = (nickname || "").trim();
        if (!emailTrim) return alert("이메일을 입력하세요.");
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrim)) return alert("유효한 이메일을 입력하세요.");
        if (!nicknameTrim) return alert("닉네임을 입력하세요.");

        try {
            const token = getStoredToken();
            if (!token) throw new Error("로그인이 필요합니다.");
            const payload = {
                email: emailTrim,
                nickname: nicknameTrim,
                displayName,
                bio,
            };
            await updateMember(token, payload);
            alert("프로필이 저장되었습니다.");
            setMenuOpen(false);
        } catch (err) {
            console.error("프로필 저장 실패", err);
            alert(err?.message || "프로필 저장에 실패했습니다.");
        }
    };

    // change password -> call changePassword(token, data)
    const changePasswordHandler = async (e) => {
        e.preventDefault();
        if (!newPw) return alert("새 비밀번호를 입력하세요");
        if (newPw !== confirmPw) return alert("새 비밀번호와 확인이 다릅니다");

        try {
            const token = getStoredToken();
            if (!token) throw new Error("로그인이 필요합니다.");
            const payload = {
                oldPassword: currentPw,
                newPassword: newPw,
                newPasswordConfirm: confirmPw,
            };
            await changePassword(token, payload);
            alert("비밀번호가 변경되었습니다.");
            setCurrentPw(""); setNewPw(""); setConfirmPw("");
            setMenuOpen(false);
        } catch (err) {
            console.error("비밀번호 변경 실패", err);
            alert(err?.message || "비밀번호 변경에 실패했습니다.");
        }
    };

    // delete account (optional) - place in preferences if needed
    const handleDeleteAccount = async () => {
        if (!confirm("정말로 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
        const pwd = prompt("탈퇴하려면 비밀번호를 입력하세요");
        if (!pwd) return alert("비밀번호가 필요합니다.");
        try {
            const token = getStoredToken();
            if (!token) throw new Error("로그인이 필요합니다.");
            await deleteMember(token, pwd);
            alert("회원 탈퇴 처리되었습니다.");
            removeToken();
            router.push("/signup");
        } catch (err) {
            console.error("회원 탈퇴 실패", err);
            alert(err?.message || "회원 탈퇴에 실패했습니다.");
        }
    };

    // preferences save (placeholder -> stays same look but hover shows color)
    const savePreferences = (e) => {
        e.preventDefault();
        // TODO: implement preferences API if available
        alert("설정이 저장되었습니다 (예시)");
        setMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/30 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-10 py-4 flex justify-between items-center">
                    <h1
                        onClick={() => router.push("/dashboard")}
                        className="text-lg font-semibold tracking-wide cursor-pointer hover:text-gray-300 transition"
                    >
                        Crypto Journal
                    </h1>

                    {/* 오른쪽: 내 정보 드롭다운 + 로그아웃 버튼 */}
                    <div className="flex items-center gap-4">
                        <div>
                            <button
                                ref={buttonRef}
                                onClick={() => setMenuOpen((s) => !s)}
                                aria-haspopup="true"
                                aria-expanded={menuOpen}
                                className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition"
                            >
                                내 정보
                            </button>
                        </div>

                        {/* logout */}
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </header>

            {/* Fixed dropdown (renders above content, profile/password/preferences inside) */}
            {menuOpen && (
                <div
                    ref={menuRef}
                    style={{ top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width }}
                    className="fixed bg-[#0b0f1a]/95 border border-white/10 rounded-lg shadow-2xl z-[9999] max-h-[70vh] overflow-y-auto"
                >
                    {/* tab nav */}
                    <div className="flex gap-1 p-2">
                        <button
                            onClick={() => setActiveTab("profile")}
                            className={`flex-1 px-3 py-2 rounded ${activeTab === "profile" ? "bg-indigo-600" : "bg-white/5"}`}
                        >
                            정보 수정
                        </button>
                        <button
                            onClick={() => setActiveTab("password")}
                            className={`flex-1 px-3 py-2 rounded ${activeTab === "password" ? "bg-indigo-600" : "bg-white/5"}`}
                        >
                            비밀번호
                        </button>
                        <button
                            onClick={() => setActiveTab("preferences")}
                            className={`flex-1 px-3 py-2 rounded ${activeTab === "preferences" ? "bg-indigo-600" : "bg-white/5"}`}
                        >
                            환경설정
                        </button>
                    </div>

                    <div className="p-4 border-t border-white/5">
                        {activeTab === "profile" && (
                            <form onSubmit={saveProfile} className="space-y-3">
                                {loadingProfile ? (
                                    <div className="text-sm text-white/60">불러오는 중...</div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs text-white/70 mb-1">이메일</label>
                                            <input
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full px-3 py-2 rounded bg-gray-800"
                                                placeholder="email@example.com"
                                                type="email"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs text-white/70 mb-1">닉네임</label>
                                            <input
                                                value={nickname}
                                                onChange={(e) => setNickname(e.target.value)}
                                                className="w-full px-3 py-2 rounded bg-gray-800"
                                                placeholder="닉네임"
                                                type="text"
                                            />
                                        </div>

                                        <div className="flex gap-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setMenuOpen(false)}
                                                className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                취소
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                저장
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
                        )}

                        {activeTab === "password" && (
                            <form onSubmit={changePasswordHandler} className="space-y-3">
                                <div>
                                    <label className="block text-xs text-white/70 mb-1">현재 비밀번호</label>
                                    <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-white/70 mb-1">새 비밀번호</label>
                                    <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-white/70 mb-1">새 비밀번호 확인</label>
                                    <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800" />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setMenuOpen(false)}
                                        className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        변경
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === "preferences" && (
                            <form onSubmit={savePreferences} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium">이메일 알림</div>
                                        <div className="text-xs text-white/60">새 글·댓글 알림 수신</div>
                                    </div>
                                    <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} className="h-5 w-5" />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium">다크 모드</div>
                                        <div className="text-xs text-white/60">UI 테마</div>
                                    </div>
                                    <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} className="h-5 w-5" />
                                </div>

                                <div className="flex gap-2 justify-between">
                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleDeleteAccount}
                                            className="px-3 py-1 bg-white/5 text-white/60 rounded transition-colors hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                        >
                                            회원 탈퇴
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setMenuOpen(false)}
                                            className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            취소
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <main className="p-10">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}