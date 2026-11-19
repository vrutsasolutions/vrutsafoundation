import { publicDb } from "@/lib/supabase/server";

export const metadata = { title: "Email preferences", robots: { index: false } };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let done = false;
  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = (await publicDb()?.rpc("unsubscribe", { p_token: token })) ?? { data: false };
    done = Boolean(data);
  }
  return (
    <div className="wrap section max-w-xl">
      <h1 className="text-4xl">{done ? "You will not receive announcements" : "This link is not valid"}</h1>
      <p className="mt-4 text-lg text-[var(--color-muted)]">
        {done ? "We have stopped announcements to this contact. Messages about your own donations, applications and registrations will still be sent."
              : "The link may be incomplete. Please use the link at the bottom of the most recent email."}
      </p>
    </div>
  );
}
