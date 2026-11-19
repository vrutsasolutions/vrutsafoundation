import { Empty } from "@/components/cards";
import { getSettings } from "@/lib/data";
import { paragraphs } from "@/lib/utils";

export const revalidate = 60;
export const metadata = { title: "Privacy policy" };

export default async function Page() {
  const s = await getSettings();
  return (
    <div className="wrap section max-w-3xl">
      <h1 className="text-4xl sm:text-5xl">Privacy policy</h1>
      <div className="prose-plain mt-8 text-lg">
        {s.privacy_policy ? paragraphs(s.privacy_policy).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)
          : <Empty>This page is being prepared by the foundation and will be published before the website is launched.</Empty>}
      </div>
    </div>
  );
}
