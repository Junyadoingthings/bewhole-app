import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Minimal renderer for admin-authored resource bodies.
 *
 * Supports paragraphs, `**bold**` lead-ins and `- ` bullets — deliberately not
 * a full markdown parser, and deliberately not dangerouslySetInnerHTML, so
 * nothing authored in the admin can inject markup into a client's page.
 */
export function Prose({ body, className }: { body: string; className?: string }) {
  const blocks = body.trim().split(/\n{2,}/);

  return (
    <div className={cn('space-y-5', className)}>
      {blocks.map((block, i) => {
        if (block.startsWith('- ')) {
          const items = block.split('\n').map((line) => line.replace(/^-\s*/, ''));
          return (
            <ul key={i} className="space-y-2.5">
              {items.map((item, j) => (
                <li key={j} className="flex gap-3 leading-relaxed text-ink-muted">
                  <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-forest-400" />
                  <span>{inline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="leading-[1.75] text-ink-muted text-pretty">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-medium text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
