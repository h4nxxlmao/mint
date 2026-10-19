import { ChevronDown } from "lucide-react";
import { faqs } from "@/lib/site";

export function FaqList() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {faqs.map((faq) => (
        <details key={faq.question} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-base font-medium text-foreground">{faq.question}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-subtle transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="max-w-[68ch] pb-5 pr-8 text-sm leading-7 text-muted">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
