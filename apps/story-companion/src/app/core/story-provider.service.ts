import { inject, Injectable } from '@angular/core';
import { LocalStoryProvider } from './local-story.provider';
import { PuterStoryProvider } from './puter-story.provider';
import type { ProviderMode, StoryProvider } from './story-types';

@Injectable({ providedIn: 'root' })
export class StoryProviderService {
  private readonly local = inject(LocalStoryProvider);
  private readonly puter = inject(PuterStoryProvider);

  forMode(mode: ProviderMode): StoryProvider {
    return mode === 'local' ? this.local : this.puter;
  }
}
