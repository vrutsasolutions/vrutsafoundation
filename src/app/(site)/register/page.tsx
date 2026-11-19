import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Create an account", robots: { index: false } };

export default function Register() {
  return (
    <div className="wrap section max-w-md">
      <h1 className="text-4xl">Create an account</h1>
      <p className="mt-3 text-[var(--color-muted)]">An account is optional. It lets you follow your volunteer application, your event registrations and your donation acknowledgements. You can donate without one.</p>
      <div className="mt-8"><RegisterForm /></div>
    </div>
  );
}
