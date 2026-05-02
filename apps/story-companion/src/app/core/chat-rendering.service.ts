import { inject, Injectable, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';

@Injectable({ providedIn: 'root' })
export class ChatRenderingService {
  private readonly sanitizer = inject(DomSanitizer);

  render(content: string): string {
    const withThinkBlocks = content.replace(
      /<think>([\s\S]*?)<\/think>/gi,
      '<details class="think-block"><summary>Thought</summary>\n\n$1\n\n</details>',
    );
    const html = marked.parse(withThinkBlocks) as string;
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
