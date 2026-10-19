export const config = {
  apiUrl: process.env.API_URL,
  apiKey: process.env.API_KEY,
  region: 'eu-west-1',
  retries: 3,
};

export function authorize(): string {
  const key = process.env.API_KEY;
  if (!key) throw new Error('API_KEY is not configured');
  return `Bearer ${key}`;
}
