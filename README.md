# Manufacturer Panel

Web frontend for the GSM Systems BLE device configuration ecosystem. This panel is the authoritative control layer for AppUsers, Devices, Device Types, BLE Profiles, device relationships, notifications, and support messages that the companion mobile application synchronizes from the backend REST API.

## Tech Stack

- React 19 + TypeScript
- Vite
- TanStack Start (SSR)
- TanStack Router (file-based routing)
- TanStack Query (server state)
- Tailwind CSS 4
- Radix UI + shadcn/ui components

## Development

Requires Node.js 20+ and npm.

```sh
git clone https://github.com/Johan-IoT/manufacturer-panel.git
cd manufacturer-panel
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## Project Structure

```
src/
  routes/          File-based routes (TanStack Router)
  components/      UI and app components
  services/        API service layer
  lib/             Auth, utilities, error handling
  data/            Mock data for development
```
