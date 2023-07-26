const PROD_API = true;

export const config = {
  api: {
    host: PROD_API ? 'https://freefeed.net' : 'http://localhost:3000'
  }
};
