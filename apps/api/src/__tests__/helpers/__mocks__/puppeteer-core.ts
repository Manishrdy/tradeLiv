const puppeteer = {
  connect: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue('<html></html>'),
      evaluate: jest.fn().mockResolvedValue({}),
      close: jest.fn(),
      setViewport: jest.fn(),
    }),
    close: jest.fn(),
  }),
};

export default puppeteer;
