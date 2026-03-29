const sharp = jest.fn().mockImplementation(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, format: 'jpeg' }),
}));

export default sharp;
