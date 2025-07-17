module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'prettier',
  ],
  plugins: [
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
  },
};