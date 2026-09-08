import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in · Roomtone" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Sign in</h1>
      <LoginForm nextPath={next ?? "/console"} />
    </>
  );
}
