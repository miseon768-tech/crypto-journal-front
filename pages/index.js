import Head from "next/head";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  const goToLogin = () => {
    router.push("/login"); // /login 페이지로 이동
  };

  return (
    <>
      <Head>
        <title>Crypto Journal</title>
        <meta
          name="description"
          content="크립토 여정을 기록하고 관리할 수 있는 Crypto Journal"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

        <main className="min-h-screen flex flex-col items-center justify-center p-8">
            <h1 className="text-4xl font-bold mb-4">
          Crypto Journal에 오신 걸 환영합니다!
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-md">
          오늘부터 나의 크립토 여정을 기록하고 관리해보세요.
        </p>
            <button
                onClick={goToLogin}
                className="mt-6 px-6 py-3 rounded-lg bg-primary text-white font-bold transform transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_4px_rgba(99,102,241,0.6)]"
            >
                GET STARTED
            </button>
      </main>
    </>
  );
}
