export function Flash({ params }: { params: Record<string, string | undefined> }) {
  return (
    <>
      {params.error && <p className="notice notice-err mb-6" role="alert">{params.error}</p>}
      {params.saved && <p className="notice notice-ok mb-6" role="status">Saved.</p>}
      {(params.result || params.notice) && <p className="notice notice-info mb-6" role="status">{params.result ?? params.notice}</p>}
      {params.link && (
        <div className="notice notice-info mb-6">
          <p className="font-semibold">Set-password link (backup)</p>
          <p className="mt-1 text-sm">It has been emailed. If email is not set up yet, copy this link and send it to the representative yourself. It works once and expires within a day.</p>
          <p className="mt-2 break-all rounded bg-white p-2 font-mono text-xs">{params.link}</p>
        </div>
      )}
    </>
  );
}
