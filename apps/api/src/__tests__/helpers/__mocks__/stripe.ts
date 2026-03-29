const Stripe = jest.fn().mockImplementation(() => ({
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      }),
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
}));

export default Stripe;
