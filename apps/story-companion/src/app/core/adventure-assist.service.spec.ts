import { AdventureAssistService } from './adventure-assist.service';

describe('AdventureAssistService', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends expected payloads to /assist', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Try talking to the gate captain.' }),
    } as Response);
    const service = new AdventureAssistService();

    const result = await service.assist({
      mode: 'suggest',
      currentText: '',
      inputType: 'action',
      scenario: null,
      messages: [],
    });

    expect(result).toBe('Try talking to the gate captain.');
    const fetchOptions = (fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(fetchOptions.body).toBe(
      JSON.stringify({
        mode: 'suggest',
        current_text: '',
        input_type: 'action',
        scenario: null,
        messages: [],
      }),
    );
  });
});
