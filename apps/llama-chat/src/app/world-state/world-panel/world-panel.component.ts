import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';
import { WorldState } from '../world-state.model';

@Component({
  selector: 'llama-world-panel',
  standalone: true,
  imports: [NgClass],
  templateUrl: './world-panel.component.html',
})
export class WorldPanelComponent {
  @Input({ required: true }) worldState!: WorldState;
  @Input() activeTab: 'scene' | 'factions' | 'npcs' | 'events' = 'scene';
  @Output() tabChange = new EventEmitter<'scene' | 'factions' | 'npcs' | 'events'>();
  @Output() panelClose = new EventEmitter<void>();

  protected standingLabel(v: number): string {
    if (v >= 75)  return 'Allied';
    if (v >= 40)  return 'Friendly';
    if (v >= 10)  return 'Neutral+';
    if (v >= -10) return 'Neutral';
    if (v >= -40) return 'Unfriendly';
    if (v >= -75) return 'Hostile';
    return 'Enemy';
  }

  protected standingColor(v: number): string {
    if (v >= 40)  return '#4caf50';
    if (v >= -10) return '#ff9800';
    if (v >= -40) return '#f44336';
    return '#9c27b0';
  }

  protected findNpcById(id: string) {
    return this.worldState.npcStates.find(n => n.npcId === id);
  }

  setTab(tab: 'scene' | 'factions' | 'npcs' | 'events'): void {
    this.tabChange.emit(tab);
  }
}
