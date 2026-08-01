import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// "base" precisa bater com o nome do repositório no GitHub — o Pages
// publica o site dentro de um subcaminho (ex: usuario.github.io/uzellar-frontend/),
// não na raiz.
export default defineConfig({
  plugins: [react()],
  base: '/uzellar-frontend/',
});
