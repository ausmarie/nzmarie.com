# NZ Marie - Real Estate Portfolio

Professional real estate website for **Marie Nian** — Licensed Residential Sales Consultant at Barfoot & Thompson, specializing in North Shore and Greater Auckland property markets.

Built with **Next.js 15**, deployed on **Vercel**, featuring bilingual support (English/Mandarin) and comprehensive property listings with market insights.

## 🚀 Getting Started

Clone the repository and install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run type-check` | Run TypeScript type checking |
| `npm run test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run init-db` | Initialize database |
| `npm run db:migrate` | Run database migrations |

## 🛠 Tech Stack

- **Framework**: Next.js 15+ App Router
- **UI Library**: Radix UI, Tailwind CSS
- **Fonts**: Poppins (Google Fonts)
- **Icons**: Lucide React, React Icons
- **Charts**: Recharts
- **Database**: PostgreSQL (CockroachDB)
- **Authentication**: NextAuth.js v5
- **Storage**: AWS S3 / Cloudflare R2
- **Deployment**: Vercel
- **Testing**: Vitest

## 📂 Project Structure

```
├── app/                    # App Router pages, layouts, and metadata
│   ├── admin/            # Admin dashboard
│   ├── api/              # API routes
│   ├── house/            # House property pages
│   ├── townhouse/       # Townhouse property pages
│   ├── reports/          # Market reports
│   └── cn/               # Chinese language routes
├── components/            # Reusable UI components
├── lib/                   # Utilities, API clients, and helpers
├── database/              # SQL schema and migrations
├── public/                # Static assets (images, favicons)
└── __tests__/             # Test files
```

## ✨ Features

- **Property Listings**: Featured properties with detailed views, image galleries, and status tracking
- **Free Appraisal**: Lead capture form for property valuation requests
- **Market Reports**: Downloadable quarterly market analysis reports
- **Bilingual Support**: English and Mandarin language options
- **Contact Integration**: Direct email, Facebook, and LinkedIn contact options
- **Admin Dashboard**: Property and lead management system
- **SEO Optimized**: Comprehensive meta tags and Open Graph support

## 📦 Deployment

This site is deployed on Vercel for global edge delivery. Push to the main branch triggers automatic production deployment.

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Features & API reference
- [Radix UI](https://www.radix-ui.com/) - Accessible UI primitives
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

© 2025 NZ Marie. All rights reserved.
