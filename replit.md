# SalesPro Dashboard

## Overview

SalesPro (PourPoint Inc.) is a full-stack sales management dashboard application for tracking daily sales, inventory, and orders. It features a React frontend with a modern UI built on shadcn/ui components, and an Express backend with PostgreSQL database storage using Drizzle ORM. The application provides modules for daily sales tracking, order management, file uploads, and various placeholder modules for future expansion (Stock, Reports, Credits, Calendar).

### Order-to-Stock Sync
- When orders are created (bulk), the system automatically syncs to `stock_details` table by matching `brand_number`
- Only orders with `data_updated = 'NO'` are processed (prevents double-counting)
- After syncing, orders are marked `data_updated = 'YES'`
- Stock fields updated: `stock_in_cases`, `stock_in_bottles`, `total_stock_bottles`, `total_stock_value`, `breakage`
- Sync aggregates multiple orders per brand before applying to stock
- Matching uses 4-way condition: brand_number, brand_name, size (from pack_size), quantity_per_case (from pack_size)

### Invoice Tracking
- Orders table has `invoice_date` and `icdc_number` columns for tracking invoices
- PDF parser extracts Invoice Date and ICDC Number from the PDF header and applies them to all parsed rows
- Saved Orders section on Inventory page supports filtering by invoice_date and icdc_number
- API endpoint: GET /api/orders?invoice_date=X&icdc_number=Y

### Stock-to-DailySales Sync
- After stock is updated (from orders or direct stock edit), daily_sales rows are auto-updated
- Matches on: brand_number, brand_name, size, quantity_per_case
- Fields updated: `opening_balance_bottles` (from total_stock_bottles), `new_stock_cases` (from stock_in_cases), `new_stock_bottles` (from stock_in_bottles)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Build Tool**: Vite with hot module replacement
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints defined in shared routes file
- **File Uploads**: Multer with memory storage
- **Development**: tsx for TypeScript execution, Vite dev server integration
- **Production Build**: esbuild for server bundling, Vite for client

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` command

### Shared Code Structure
- `shared/schema.ts`: Database table definitions and Zod schemas
- `shared/routes.ts`: API route definitions with input/output schemas
- Path aliases: `@/` for client source, `@shared/` for shared code

### Key Design Patterns
- **Type-safe API contracts**: Routes defined with Zod schemas in shared folder
- **Upsert pattern**: Sales data uses `onConflictDoUpdate` for bulk updates
- **Bulk operations**: Orders and sales support bulk create/update endpoints
- **Client-side calculations**: Sales value calculations happen in browser before save

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage for PostgreSQL (available but not currently used)

### Third-Party Libraries
- **Radix UI**: Accessible UI primitives for all interactive components
- **Lucide React**: Icon library
- **date-fns**: Date manipulation utilities
- **class-variance-authority**: Component variant management
- **embla-carousel-react**: Carousel functionality
- **recharts**: Charting library (via shadcn/ui chart component)

### Development Tools
- **Replit Vite plugins**: Runtime error overlay, cartographer, dev banner
- **Drizzle Kit**: Database schema management and migrations