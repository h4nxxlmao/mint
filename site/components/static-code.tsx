import { CopyButton } from "@/components/copy-button";
import { highlightCode } from "@/lib/highlight";

export async function StaticCode({
  code,
  lang = "bash",
  label = "Copy code",
}: {
  code: string;
  lang?: string;
  label?: string;
}) {
  const html = await highlightCode(code.trim(), lang);
  const focusableHtml = html.replace("<pre ", '<pre tabindex="0" ');

  return (
    <div className="code-frame">
      <CopyButton value={code.trim()} label={label} iconOnly className="code-copy" />
      <div dangerouslySetInnerHTML={{ __html: focusableHtml }} />
    </div>
  );
}
