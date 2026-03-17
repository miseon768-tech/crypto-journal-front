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
import { getMyLikedPosts } from "../api/post";

export default function Layout({ children }) {
    const router = useRouter();

    const [menuOpen, setMenuOpen] = useState(false);
    const [activeItem, setActiveItem] = useState(null); // 'profile'|'password'|'preferences'|'liked' | null
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, width: 360 });

    // profile state
    const [email, setEmail] = useState("");
    const [nickname, setNickname] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [loadingProfile, setLoadingProfile] = useState(false);

    // liked posts state
    const [likedPosts, setLikedPosts] = useState([]);
    const [loadingLiked, setLoadingLiked] = useState(false);

    // password state
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");

    // preferences
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    // header display nickname
    const [headerNickname, setHeaderNickname] = useState("");

    const closeMenu = () => {
        setMenuOpen(false);
        setActiveItem(null);
    };
    const toggleMenu = () => {
        setMenuOpen((s) => {
            const next = !s;
            if (next) setActiveItem(null);
            return next;
        });
    };

    const handleLogout = () => {
        try { removeToken(); } catch (e) {}
        closeMenu();
        router.push("/login");
    };

    // outside click / ESC
    useEffect(() => {
        function onDocClick(e) {
            if (!menuOpen) return;
            if (menuRef.current && !menuRef.current.contains(e.target) && buttonRef.current && !buttonRef.current.contains(e.target)) {
                closeMenu();
            }
        }
        function onKey(e) {
            if (e.key === "Escape") closeMenu();
        }
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    // position dropdown relative to button
    useEffect(() => {
        const DROPDOWN_WIDTH = 360;
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
            const top = Math.round(rect.bottom + scrollY + 8);
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

    // load profile when profile accordion opened
    useEffect(() => {
        if (!menuOpen) return;
        if (activeItem !== "profile") return;
        let mounted = true;
        (async () => {
            setLoadingProfile(true);
            try {
                const token = getStoredToken();
                if (!token) { setEmail(""); setNickname(""); setDisplayName(""); setBio(""); return; }
                const data = await getMyInfo(token);
                const user = data?.member ?? data?.data ?? data ?? {};
                if (!mounted) return;
                setEmail(user.email ?? "");
                setNickname(user.nickname ?? user.nick ?? "");
                setDisplayName(user.displayName ?? user.name ?? "");
                setBio(user.bio ?? user.introduce ?? "");
                if (user.notifyEmail !== undefined) setNotifyEmail(Boolean(user.notifyEmail));
                if (user.darkMode !== undefined) setDarkMode(Boolean(user.darkMode));
            } catch (err) {
                console.error("프로필 로드 실패", err);
            } finally {
                if (mounted) setLoadingProfile(false);
            }
        })();
        return () => { mounted = false; };
    }, [menuOpen, activeItem]);

    // load header nickname on mount (if logged in)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const token = getStoredToken();
                if (!token) return;
                const data = await getMyInfo(token);
                if (!mounted) return;
                const user = data?.member ?? data?.data ?? data ?? {};
                const nick = user.nickname ?? user.nick ?? user.displayName ?? "";
                if (nick) setHeaderNickname(nick);
            } catch (e) {
                // ignore
            }
        })();
        return () => { mounted = false; };
    }, []);

    // load liked posts when liked accordion opened
    useEffect(() => {
        if (!menuOpen) return;
        if (activeItem !== "liked") return;
        let mounted = true;
        (async () => {
            setLoadingLiked(true);
            try {
                const token = getStoredToken();
                if (!token) { setLikedPosts([]); return; }
                const data = await getMyLikedPosts(token);
                if (!mounted) return;
                let list;
                if (Array.isArray(data)) list = data;
                else if (data?.posts && Array.isArray(data.posts)) list = data.posts;
                else if (data?.data && Array.isArray(data.data)) list = data.data;
                else if (data?.postList && Array.isArray(data.postList)) list = data.postList;
                else list = (data && typeof data === 'object') ? Object.values(data).find(v => Array.isArray(v)) || [] : [];
                setLikedPosts(list.map(item => item?.post ?? item));
            } catch (err) {
                console.error('내 좋아요 글 로드 실패', err);
                setLikedPosts([]);
            } finally {
                if (mounted) setLoadingLiked(false);
            }
        })();
        return () => { mounted = false; };
    }, [menuOpen, activeItem]);

    // save profile
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
            const payload = { email: emailTrim, nickname: nicknameTrim, displayName, bio };
            await updateMember(token, payload);
            alert("프로필이 저장되었습니다.");
            // update header nickname if changed
            if (nickname) setHeaderNickname(nickname);
            setActiveItem(null);
            setMenuOpen(false);
        } catch (err) {
            console.error("프로필 저장 실패", err);
            alert(err?.message || "프로필 저장에 실패했습니다.");
        }
    };

    // change password
    const changePasswordHandler = async (e) => {
        e.preventDefault();
        if (!newPw) return alert("새 비밀번호를 입력하세요");
        if (newPw !== confirmPw) return alert("새 비밀번호와 확인이 다릅니다");
        try {
            const token = getStoredToken();
            if (!token) throw new Error("로그인이 필요합니다.");
            const payload = { oldPassword: currentPw, newPassword: newPw, newPasswordConfirm: confirmPw };
            await changePassword(token, payload);
            alert("비밀번호가 변경되었습니다.");
            setCurrentPw(""); setNewPw(""); setConfirmPw("");
            setActiveItem(null);
            setMenuOpen(false);
        } catch (err) {
            console.error("비밀번호 변경 실패", err);
            alert(err?.message || "비밀번호 변경에 실패했습니다.");
        }
    };

    // delete account
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

    const savePreferences = (e) => { e.preventDefault(); alert("설정이 저장되었습니다 (예시)"); setActiveItem(null); setMenuOpen(false); };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/30 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-10 py-4 flex justify-between items-center">
                    <h1 onClick={() => router.push("/")} className="text-lg font-semibold tracking-wide cursor-pointer hover:text-gray-300 transition">Crypto Journal</h1>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-white/80 mr-2">{headerNickname ? `${headerNickname} 님` : null}</div>
                        <div>
                            <button ref={buttonRef} onClick={toggleMenu} aria-haspopup="true" aria-expanded={menuOpen} className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition">내 정보</button>
                        </div>
                        <button onClick={handleLogout} className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition">로그아웃</button>
                    </div>
                </div>
            </header>

            {menuOpen && (
                <div ref={menuRef} style={{ top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width }} className="fixed bg-[#0b0f1a]/95 border border-white/10 rounded-lg shadow-2xl z-[9999] max-h-[70vh] overflow-y-auto">
                    <div className="p-2">
                        {/* Accordion list: clicking an item toggles its content shown right below the item */}
                        <div className="flex flex-col">
                            <div>
                                <button onClick={() => setActiveItem(activeItem === 'profile' ? null : 'profile')} className={`w-full text-left px-4 py-3 rounded ${activeItem === 'profile' ? 'bg-white/6' : 'bg-white/5'} hover:bg-white/5`}>정보 수정</button>
                                {activeItem === 'profile' && (
                                    <div className="p-4 border-l border-white/5 bg-black/80">
                                        <form onSubmit={saveProfile} className="space-y-3">
                                            {loadingProfile ? <div className="text-sm text-white/60">로딩 중...</div> : (
                                                <>
                                                    <div>
                                                        <label className="block text-xs text-white/70 mb-1">이메일</label>
                                                        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800" placeholder="email@example.com" type="email" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-white/70 mb-1">닉네임</label>
                                                        <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-800" placeholder="닉네임" type="text" />
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        <button type="button" onClick={() => setActiveItem(null)} className="px-3 py-1 bg-white/5 rounded hover:bg-indigo-600">취소</button>
                                                        <button type="submit" className="px-3 py-1 bg-white/5 rounded hover:bg-indigo-600">저장</button>
                                                    </div>
                                                </>
                                            )}
                                        </form>
                                    </div>
                                )}
                            </div>

                            <div>
                                <button onClick={() => setActiveItem(activeItem === 'password' ? null : 'password')} className={`w-full text-left px-4 py-3 rounded ${activeItem === 'password' ? 'bg-white/6' : 'bg-white/5'} hover:bg-white/5`}>비밀번호 변경</button>
                                {activeItem === 'password' && (
                                    <div className="p-4 border-l border-white/5 bg-black/80">
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
                                                <button type="button" onClick={() => setActiveItem(null)} className="px-3 py-1 bg-white/5 rounded hover:bg-indigo-600">취소</button>
                                                <button type="submit" className="px-3 py-1 bg-white/5 rounded hover:bg-indigo-600">변경</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>

                            <div>
                                <button onClick={() => setActiveItem(activeItem === 'preferences' ? null : 'preferences')} className={`w-full text-left px-4 py-3 rounded ${activeItem === 'preferences' ? 'bg-white/6' : 'bg-white/5'} hover:bg-white/5`}>설정</button>
                                {activeItem === 'preferences' && (
                                    <div className="p-4 border-l border-white/5 bg-black/80">
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
                                                    <button type="button" onClick={handleDeleteAccount} className="px-3 py-1 bg-white/5 text-white/60 rounded hover:bg-red-600">회원 탈퇴</button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => setActiveItem(null)} className="px-3 py-1 bg-white/5 rounded hover:bg-indigo-600">취소</button>
                                                    <button type="submit" className="px-3 py-1 bg-white/5 rounded hover:bg-indigo-600">저장</button>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>

                            <div>
                                <button onClick={() => setActiveItem(activeItem === 'liked' ? null : 'liked')} className={`w-full text-left px-4 py-3 rounded ${activeItem === 'liked' ? 'bg-white/6' : 'bg-white/5'} hover:bg-white/5`}>좋아요 한 글</button>
                                {activeItem === 'liked' && (
                                    <div className="p-4 border-l border-white/5 bg-black/80">
                                        {loadingLiked ? <div className="text-sm text-white/60">로딩 중...</div> : (
                                            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
                                                {likedPosts.length === 0 ? <div className="text-sm text-white/60">좋아요한 글이 없습니다.</div> : (
                                                    likedPosts.map((p, idx) => {
                                                        const id = p?.id ?? p?.postId ?? p?.post_id ?? p?._id ?? (p?.post && (p.post.id ?? p.post.postId));
                                                        const title = p?.title ?? p?.subject ?? (p?.post && (p.post.title ?? p.post.subject)) ?? '제목 없음';
                                                        return (
                                                            <div key={idx} className="p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer" onClick={() => { try { setActiveItem(null); } catch (e) {} router.push({ pathname: '/dashboard', query: { tab: 'community', postId: id } }, undefined, { shallow: true }); }}>
                                                                <div className="text-sm">{title}</div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                        <div className="flex gap-2 justify-end mt-2">
                                            <button type="button" onClick={() => setActiveItem(null)} className="px-3 py-1 bg-white/5 rounded hover:bg-indigo-600">닫기</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <main className="p-10">
                <div className="max-w-6xl mx-auto">{children}</div>
            </main>
        </div>
    );
}