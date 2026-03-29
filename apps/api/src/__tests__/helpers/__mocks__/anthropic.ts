// Shared mock create function — all Anthropic instances return the same one
// so tests can configure it via getMockCreate()
const mockCreate = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: '{}' }],
});

const sharedInstance = {
  messages: { create: mockCreate },
};

const Anthropic = jest.fn().mockImplementation(() => sharedInstance);

export default Anthropic;
