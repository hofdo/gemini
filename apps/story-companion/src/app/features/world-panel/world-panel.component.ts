import { Component, Input, signal } from '@angular/core';
import type { StoryWorldState } from '../../core/story-types';

@Component({
  selector: 'story-world-panel',
  templateUrl: './world-panel.component.html',
  styleUrl: './world-panel.component.scss',
})
export class WorldPanelComponent {
  @Input() worldState: StoryWorldState | null = null;
  readonly tab = signal<'scene' | 'factions' | 'npcs' | 'events' | 'quests'>('scene');
}
