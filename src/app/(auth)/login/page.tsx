import { Logo } from "@/components/shared/logo";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const params = await searchParams;
  const isVerify = params.verify === "1";

  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-4">
      <div className="mb-8">
        <Logo />
      </div>
      <LoginForm isVerify={isVerify} />
    </div>
  );
}
