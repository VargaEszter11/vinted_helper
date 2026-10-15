export const idParams = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
};

export const price = { type: 'number', minimum: 0, maximum: 9999999999 };

export const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
