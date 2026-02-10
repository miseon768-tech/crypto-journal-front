export default function Layout({ children }) {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-10">
            <div className="max-w-6xl mx-auto">
                {children}
            </div>
        </main>
    );
}