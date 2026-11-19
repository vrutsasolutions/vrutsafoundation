import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap section">
      <h1 className="text-5xl">This page does not exist</h1>
      <p className="lede mt-4">It may have been moved or unpublished.</p>
      <Link href="/" className="btn btn-leaf mt-8">Go to the homepage</Link>
    </main>
  );
}
