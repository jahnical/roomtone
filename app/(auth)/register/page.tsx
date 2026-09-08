import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Create account · Roomtone" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Create your account</h1>
      <RegisterForm nextPath={next ?? "/console"} />
    </>
  );
}
