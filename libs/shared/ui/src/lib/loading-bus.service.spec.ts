import { TestBed } from '@angular/core/testing';
import { LoadingBusService } from './loading-bus.service';

describe('LoadingBusService', () => {
  let service: LoadingBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LoadingBusService] });
    service = TestBed.inject(LoadingBusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise with all flags false', () => {
    expect(service.chatLoading()).toBe(false);
    expect(service.worldUpdateLoading()).toBe(false);
    expect(service.assistLoading()).toBe(false);
    expect(service.anyLoading()).toBe(false);
  });

  it('should set chatLoading to true', () => {
    service.set('chat', true);
    expect(service.chatLoading()).toBe(true);
  });

  it('should set worldUpdateLoading to true', () => {
    service.set('worldUpdate', true);
    expect(service.worldUpdateLoading()).toBe(true);
  });

  it('should set assistLoading to true', () => {
    service.set('assist', true);
    expect(service.assistLoading()).toBe(true);
  });

  it('anyLoading should be true when any key is set', () => {
    service.set('chat', true);
    expect(service.anyLoading()).toBe(true);
  });

  it('anyLoading should be false after all keys are cleared', () => {
    service.set('chat', true);
    service.set('assist', true);
    service.set('chat', false);
    service.set('assist', false);
    expect(service.anyLoading()).toBe(false);
  });

  it('should not affect other flags when one key changes', () => {
    service.set('chat', true);
    expect(service.assistLoading()).toBe(false);
    expect(service.worldUpdateLoading()).toBe(false);
  });
});
