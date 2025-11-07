import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig(async () => {
  // 三重禁忌 ignore, TODO: investigate typescript and nodejs config
  // eslint-disable-next-line
  // @ts-ignore
  // eslint-disable-next-line import/no-unresolved
  const tailwind = await import('@tailwindcss/vite');
  // eslint-disable-next-line
  // @ts-ignore
  // eslint-disable-next-line import/no-unresolved
  const react = await import('@vitejs/plugin-react');

  return {
    plugins: [tailwind.default?.(), react.default?.()],
  };
});
