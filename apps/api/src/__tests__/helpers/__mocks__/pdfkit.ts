import { PassThrough } from 'stream';

const PDFDocument = jest.fn().mockImplementation(() => {
  const stream = new PassThrough();
  return Object.assign(stream, {
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    fill: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    pipe: stream.pipe.bind(stream),
    end: () => { stream.end(); },
  });
});

export default PDFDocument;
