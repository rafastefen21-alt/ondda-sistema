import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
