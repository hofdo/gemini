import { TestBed } from '@angular/core/testing';

import { ChatRenderingService } from './chat-rendering.service';

describe('ChatRenderingService', () => {
  it('renders markdown and wraps think blocks in details', () => {
    TestBed.configureTestingModule({
      providers: [ChatRenderingService],
    });
    const service = TestBed.inject(ChatRenderingService);

    const html = service.render('**Bold**<think>hidden</think><script>alert(1)</script>');

    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<details');
    expect(html).not.toContain('<script');
  });
});
