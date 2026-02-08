// pages/index.js
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>Crypto Journal</title>
        <meta
          name="description"
          content="Crypto Journal with Next.js + Tailwind"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-4">Hello, Crypto Journal!</h1>
        <p className="text-lg text-muted-foreground">
          This is your Tailwind + custom CSS setup.
        </p>
        <button className="mt-6 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
          Get Started
        </button>
      </main>
    </>
  );
}
