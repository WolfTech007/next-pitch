import { LoginForm } from "./LoginForm";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage(props: Props) {
  const sp = await props.searchParams;
  const nextPath = typeof sp.next === "string" ? sp.next : "/";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
